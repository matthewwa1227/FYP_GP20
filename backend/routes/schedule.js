// routes/schedule.js

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { requireOnboarding, checkScheduleLimits, TIER_CONFIG } = require('../middleware/scheduleGuard');

// All routes require auth
router.use(authenticateToken);

// ============================================
// POST /create — Create a new learning schedule
// ============================================
router.post('/create', requireOnboarding, async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic, subject, hkCodes } = req.body;
    const { formLevel, ageTier, tierConfig } = req.tierInfo;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    // Check for existing active schedule on same topic
    const existing = await db.query(
      `SELECT id FROM learning_schedules 
       WHERE student_id = $1 AND topic = $2 AND status = 'active'`,
      [userId, topic.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active schedule for this topic',
        data: { existingScheduleId: existing.rows[0].id }
      });
    }

    // Build chapter structure based on tier
    const totalChapters = tierConfig.chaptersDefault;
    const chapters = [];
    for (let i = 1; i <= totalChapters; i++) {
      chapters.push({
        chapter: i,
        status: i === 1 ? 'in_progress' : 'locked',
        mastery: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        scenesCompleted: [],
        startedAt: i === 1 ? new Date().toISOString() : null,
        completedAt: null
      });
    }

    // Insert schedule
    const result = await db.query(
      `INSERT INTO learning_schedules (
        student_id, topic, subject, form_level, age_tier,
        total_chapters, current_chapter, chapters,
        hk_codes, mastery_gate
      )
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7::jsonb, $8, $9)
       RETURNING *`,
      [
        userId,
        topic.trim(),
        subject || null,
        formLevel,
        ageTier,
        totalChapters,
        JSON.stringify(chapters),
        hkCodes || [],
        tierConfig.masteryGate
      ]
    );

    const schedule = result.rows[0];

    // Also create/update story_quest_progress entry
    await db.query(
      `INSERT INTO story_quest_progress (user_id, topic, chapter, xp, hp, inventory, completed, schedule_id)
       VALUES ($1, $2, 1, 0, 100, '{"items":[]}'::jsonb, false, $3)
       ON CONFLICT (user_id, topic) DO UPDATE SET
         schedule_id = $3,
         chapter = 1,
         completed = false,
         updated_at = NOW()`,
      [userId, topic.trim(), schedule.id]
    ).catch(err => {
      // story_quest_progress might not have a unique constraint on (user_id, topic)
      // In that case, just insert
      console.log('Note: story_quest_progress upsert fallback:', err.message);
      return db.query(
        `INSERT INTO story_quest_progress (user_id, topic, chapter, xp, hp, inventory, completed, schedule_id)
         VALUES ($1, $2, 1, 0, 100, '{"items":[]}'::jsonb, false, $3)`,
        [userId, topic.trim(), schedule.id]
      );
    });

    res.status(201).json({
      success: true,
      message: `Schedule created for "${topic}" (${ageTier} tier, ${totalChapters} chapters)`,
      data: {
        schedule: {
          id: schedule.id,
          topic: schedule.topic,
          subject: schedule.subject,
          formLevel: schedule.form_level,
          ageTier: schedule.age_tier,
          totalChapters: schedule.total_chapters,
          currentChapter: schedule.current_chapter,
          chapters: schedule.chapters,
          masteryGate: schedule.mastery_gate,
          status: schedule.status,
          createdAt: schedule.created_at
        },
        tierConfig: {
          dailyMinutes: TIER_CONFIG[ageTier].dailyMinutes,
          weeklyDays: TIER_CONFIG[ageTier].weeklyDays,
          masteryGate: TIER_CONFIG[ageTier].masteryGate
        }
      }
    });

  } catch (error) {
    console.error('❌ Schedule create error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// GET /active — Get all active schedules
// ============================================
router.get('/active', requireOnboarding, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        ls.*,
        sqp.xp AS game_xp,
        sqp.hp AS game_hp,
        sqp.inventory AS game_inventory,
        COALESCE(
          (SELECT SUM(dsl.actual_minutes) 
           FROM daily_session_log dsl 
           WHERE dsl.schedule_id = ls.id), 0
        )::int AS total_session_minutes
       FROM learning_schedules ls
       LEFT JOIN story_quest_progress sqp 
         ON sqp.schedule_id = ls.id
       WHERE ls.student_id = $1 AND ls.status = 'active'
       ORDER BY ls.updated_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        topic: row.topic,
        subject: row.subject,
        formLevel: row.form_level,
        ageTier: row.age_tier,
        totalChapters: row.total_chapters,
        currentChapter: row.current_chapter,
        chapters: row.chapters,
        overallMastery: parseFloat(row.overall_mastery),
        masteryGate: row.mastery_gate,
        totalTimeSpent: row.total_session_minutes,
        gameState: {
          xp: row.game_xp || 0,
          hp: row.game_hp || 100,
          inventory: row.game_inventory || {}
        },
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });

  } catch (error) {
    console.error('❌ Get active schedules error:', error);
    res.status(500).json({ success: false, message: 'Error fetching schedules' });
  }
});

// ============================================
// GET /today — Today's session info for a schedule
// ============================================
router.get('/today', checkScheduleLimits, async (req, res) => {
  try {
    const userId = req.user.id;
    const scheduleId = req.query.scheduleId;

    // Get active schedule (specific or most recent)
    let scheduleQuery;
    let scheduleParams;

    if (scheduleId) {
      scheduleQuery = `
        SELECT * FROM learning_schedules 
        WHERE id = $1 AND student_id = $2 AND status = 'active'`;
      scheduleParams = [scheduleId, userId];
    } else {
      scheduleQuery = `
        SELECT * FROM learning_schedules 
        WHERE student_id = $1 AND status = 'active'
        ORDER BY updated_at DESC LIMIT 1`;
      scheduleParams = [userId];
    }

    const scheduleResult = await db.query(scheduleQuery, scheduleParams);

    if (scheduleResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          hasSchedule: false,
          message: 'No active schedule. Create one to start learning!',
          timeInfo: {
            dailyLimit: req.scheduleInfo.dailyLimit,
            todayUsed: req.scheduleInfo.todayUsed,
            remaining: req.scheduleInfo.remaining
          }
        }
      });
    }

    const schedule = scheduleResult.rows[0];

    // Check for existing session today
    const todaySession = await db.query(
      `SELECT * FROM daily_session_log 
       WHERE student_id = $1 AND schedule_id = $2 AND session_date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, schedule.id]
    );

    const hasSessionToday = todaySession.rows.length > 0;
    const currentSession = hasSessionToday ? todaySession.rows[0] : null;

    // Determine current chapter info
    const chapters = schedule.chapters || [];
    const currentChapterData = chapters.find(c => c.chapter === schedule.current_chapter) || {};

    res.json({
      success: true,
      data: {
        hasSchedule: true,
        schedule: {
          id: schedule.id,
          topic: schedule.topic,
          currentChapter: schedule.current_chapter,
          totalChapters: schedule.total_chapters,
          overallMastery: parseFloat(schedule.overall_mastery),
          masteryGate: schedule.mastery_gate
        },
        currentChapter: currentChapterData,
        todaySession: currentSession ? {
          id: currentSession.id,
          startedAt: currentSession.session_started_at,
          minutesUsed: currentSession.actual_minutes,
          questionsAnswered: currentSession.questions_answered,
          questionsCorrect: currentSession.questions_correct,
          isActive: !currentSession.session_ended_at
        } : null,
        timeInfo: {
          dailyLimit: req.scheduleInfo.dailyLimit,
          todayUsed: req.scheduleInfo.todayUsed,
          remaining: req.scheduleInfo.remaining,
          shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
        },
        canPlay: req.scheduleInfo.remaining > 0
      }
    });

  } catch (error) {
    console.error('❌ Get today session error:', error);
    res.status(500).json({ success: false, message: 'Error fetching today info' });
  }
});

// ============================================
// POST /start-session — Start a daily session
// ============================================
router.post('/start-session', checkScheduleLimits, async (req, res) => {
  try {
    const userId = req.user.id;
    const { scheduleId } = req.body;

    if (!scheduleId) {
      return res.status(400).json({
        success: false,
        message: 'scheduleId is required'
      });
    }

    // Verify schedule belongs to student
    const schedule = await db.query(
      `SELECT * FROM learning_schedules 
       WHERE id = $1 AND student_id = $2 AND status = 'active'`,
      [scheduleId, userId]
    );

    if (schedule.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active schedule not found'
      });
    }

    // Check if there's already an active (un-ended) session today
    const activeSession = await db.query(
      `SELECT id FROM daily_session_log 
       WHERE student_id = $1 AND schedule_id = $2 
         AND session_date = CURRENT_DATE 
         AND session_ended_at IS NULL`,
      [userId, scheduleId]
    );

    if (activeSession.rows.length > 0) {
      // Resume existing session instead of creating new
      return res.json({
        success: true,
        message: 'Resuming existing session',
        data: {
          sessionId: activeSession.rows[0].id,
          resumed: true,
          timeInfo: {
            dailyLimit: req.scheduleInfo.dailyLimit,
            remaining: req.scheduleInfo.remaining
          },
          currentChapter: schedule.rows[0].current_chapter
        }
      });
    }

    // Create new session
    const result = await db.query(
      `INSERT INTO daily_session_log (
        student_id, schedule_id, session_date, session_started_at,
        planned_minutes, chapter
      )
       VALUES ($1, $2, CURRENT_DATE, NOW(), $3, $4)
       RETURNING *`,
      [
        userId,
        scheduleId,
        req.scheduleInfo.remaining,
        schedule.rows[0].current_chapter
      ]
    );

    const session = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Session started!',
      data: {
        sessionId: session.id,
        resumed: false,
        startedAt: session.session_started_at,
        timeInfo: {
          dailyLimit: req.scheduleInfo.dailyLimit,
          remaining: req.scheduleInfo.remaining,
          plannedMinutes: session.planned_minutes
        },
        currentChapter: session.chapter,
        topic: schedule.rows[0].topic
      }
    });

  } catch (error) {
    console.error('❌ Start session error:', error);
    res.status(500).json({ success: false, message: 'Error starting session' });
  }
});

// ============================================
// PATCH /log-progress — Update progress mid-session
// ============================================
router.patch('/log-progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sessionId,
      scheduleId,
      questionsAnswered,
      questionsCorrect,
      sceneCompleted,
      xpEarned
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required'
      });
    }

    // Calculate actual minutes from wall clock
    const session = await db.query(
      `SELECT session_started_at, schedule_id FROM daily_session_log 
       WHERE id = $1 AND student_id = $2`,
      [sessionId, userId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const startedAt = new Date(session.rows[0].session_started_at);
    const actualMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
    const activeScheduleId = session.rows[0].schedule_id;

    // Update the session log
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    // Always update actual_minutes from wall clock
    paramCount++;
    updateFields.push(`actual_minutes = $${paramCount}`);
    updateValues.push(actualMinutes);

    if (questionsAnswered !== undefined) {
      paramCount++;
      updateFields.push(`questions_answered = questions_answered + $${paramCount}`);
      updateValues.push(questionsAnswered);
    }

    if (questionsCorrect !== undefined) {
      paramCount++;
      updateFields.push(`questions_correct = questions_correct + $${paramCount}`);
      updateValues.push(questionsCorrect);
    }

    if (sceneCompleted) {
      paramCount++;
      updateFields.push(`scenes_completed = array_append(scenes_completed, $${paramCount})`);
      updateValues.push(sceneCompleted);
    }

    if (xpEarned) {
      paramCount++;
      updateFields.push(`xp_earned = xp_earned + $${paramCount}`);
      updateValues.push(xpEarned);
    }

    paramCount++;
    updateValues.push(sessionId);

    const updatedSession = await db.query(
      `UPDATE daily_session_log 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      updateValues
    );

    // Check time limit
    const studentResult = await db.query(
      `SELECT daily_time_limit_minutes FROM students WHERE id = $1`,
      [userId]
    );
    const dailyLimit = studentResult.rows[0]?.daily_time_limit_minutes || 60;

    // Get total today
    const todayTotal = await db.query(
      `SELECT COALESCE(SUM(actual_minutes), 0)::int AS total
       FROM daily_session_log
       WHERE student_id = $1 AND session_date = CURRENT_DATE`,
      [userId]
    );
    const todayUsed = todayTotal.rows[0].total;
    const remaining = Math.max(0, dailyLimit - todayUsed);
    const exceededLimit = remaining <= 0;

    // Update schedule mastery if we have question data
    if (activeScheduleId && (questionsAnswered || questionsCorrect)) {
      // Update learning_schedules chapter mastery
      const scheduleData = await db.query(
        `SELECT chapters, current_chapter FROM learning_schedules WHERE id = $1`,
        [activeScheduleId]
      );

      if (scheduleData.rows.length > 0) {
        const chapters = scheduleData.rows[0].chapters || [];
        const currentChapter = scheduleData.rows[0].current_chapter;
        const chapterIdx = chapters.findIndex(c => c.chapter === currentChapter);

        if (chapterIdx >= 0) {
          chapters[chapterIdx].questionsAnswered =
            (chapters[chapterIdx].questionsAnswered || 0) + (questionsAnswered || 0);
          chapters[chapterIdx].questionsCorrect =
            (chapters[chapterIdx].questionsCorrect || 0) + (questionsCorrect || 0);

          // Recalculate chapter mastery
          if (chapters[chapterIdx].questionsAnswered > 0) {
            chapters[chapterIdx].mastery = Math.round(
              (chapters[chapterIdx].questionsCorrect / chapters[chapterIdx].questionsAnswered) * 100
            );
          }

          await db.query(
            `UPDATE learning_schedules 
             SET chapters = $1::jsonb,
                 total_questions_answered = total_questions_answered + $2,
                 total_questions_correct = total_questions_correct + $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [
              JSON.stringify(chapters),
              questionsAnswered || 0,
              questionsCorrect || 0,
              activeScheduleId
            ]
          );
        }
      }
    }

    // Flag if exceeded
    if (exceededLimit) {
      await db.query(
        `UPDATE daily_session_log SET exceeded_time_limit = TRUE WHERE id = $1`,
        [sessionId]
      );
    }

    res.json({
      success: true,
      data: {
        sessionId,
        actualMinutes,
        todayUsed,
        remaining,
        exceededLimit,
        shouldWrapUp: remaining <= 3,
        shouldStop: remaining <= 0,
        sessionStats: {
          questionsAnswered: updatedSession.rows[0].questions_answered,
          questionsCorrect: updatedSession.rows[0].questions_correct,
          xpEarned: updatedSession.rows[0].xp_earned
        }
      }
    });

  } catch (error) {
    console.error('❌ Log progress error:', error);
    res.status(500).json({ success: false, message: 'Error logging progress' });
  }
});

// ============================================
// POST /end-session — End a session + mastery check
// ============================================
router.post('/end-session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    // Finalize session log
    const session = await db.query(
      `UPDATE daily_session_log 
       SET session_ended_at = NOW(),
           actual_minutes = GREATEST(
             actual_minutes,
             EXTRACT(EPOCH FROM (NOW() - session_started_at))::int / 60
           )
       WHERE id = $1 AND student_id = $2
       RETURNING *`,
      [sessionId, userId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const endedSession = session.rows[0];
    const scheduleId = endedSession.schedule_id;

    // Update total time on learning_schedules
    if (scheduleId) {
      await db.query(
        `UPDATE learning_schedules 
         SET total_time_spent_minutes = total_time_spent_minutes + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [endedSession.actual_minutes, scheduleId]
      );
    }

    // Calculate mastery for mastery gate check
    let masteryResult = null;
    if (scheduleId) {
      const schedule = await db.query(
        `SELECT chapters, current_chapter, mastery_gate, total_chapters 
         FROM learning_schedules WHERE id = $1`,
        [scheduleId]
      );

      if (schedule.rows.length > 0) {
        const { chapters, current_chapter, mastery_gate, total_chapters } = schedule.rows[0];
        const currentChapterData = (chapters || []).find(c => c.chapter === current_chapter);

        if (currentChapterData) {
          const chapterMastery = currentChapterData.mastery || 0;
          const canAdvance = chapterMastery >= mastery_gate && currentChapterData.questionsAnswered >= 3;
          const isLastChapter = current_chapter >= total_chapters;

          masteryResult = {
            currentChapter: current_chapter,
            chapterMastery,
            masteryGate: mastery_gate,
            questionsAnswered: currentChapterData.questionsAnswered,
            canAdvance,
            isLastChapter,
            message: canAdvance
              ? (isLastChapter ? 'Congratulations! Topic completed!' : `Chapter ${current_chapter} mastered! Ready for Chapter ${current_chapter + 1}`)
              : `Need ${mastery_gate}% mastery to advance (currently ${chapterMastery}%). Keep practicing!`
          };

          // Auto-advance if mastery met
          if (canAdvance && !isLastChapter) {
            const updatedChapters = [...chapters];
            const curIdx = updatedChapters.findIndex(c => c.chapter === current_chapter);
            const nextIdx = updatedChapters.findIndex(c => c.chapter === current_chapter + 1);

            if (curIdx >= 0) updatedChapters[curIdx].status = 'completed';
            if (curIdx >= 0) updatedChapters[curIdx].completedAt = new Date().toISOString();
            if (nextIdx >= 0) updatedChapters[nextIdx].status = 'in_progress';
            if (nextIdx >= 0) updatedChapters[nextIdx].startedAt = new Date().toISOString();

            await db.query(
              `UPDATE learning_schedules 
               SET current_chapter = current_chapter + 1,
                   chapters = $1::jsonb,
                   current_day_in_chapter = 1,
                   updated_at = NOW()
               WHERE id = $2`,
              [JSON.stringify(updatedChapters), scheduleId]
            );

            // Update story_quest_progress chapter too
            await db.query(
              `UPDATE story_quest_progress 
               SET chapter = chapter + 1, updated_at = NOW()
               WHERE schedule_id = $1 AND user_id = $2`,
              [scheduleId, userId]
            ).catch(() => {});
          }

          // Complete the topic if last chapter mastered
          if (canAdvance && isLastChapter) {
            await db.query(
              `UPDATE learning_schedules SET status = 'completed', updated_at = NOW() WHERE id = $1`,
              [scheduleId]
            );
            await db.query(
              `UPDATE story_quest_progress SET completed = TRUE, updated_at = NOW() WHERE schedule_id = $1`,
              [scheduleId]
            ).catch(() => {});
          }

          // Recalculate overall mastery
          const allAnswered = chapters.reduce((sum, c) => sum + (c.questionsAnswered || 0), 0);
          const allCorrect = chapters.reduce((sum, c) => sum + (c.questionsCorrect || 0), 0);
          const overall = allAnswered > 0 ? Math.round((allCorrect / allAnswered) * 100) : 0;

          await db.query(
            `UPDATE learning_schedules SET overall_mastery = $1 WHERE id = $2`,
            [overall, scheduleId]
          );
        }
      }
    }

    // Simple burnout check: 7+ consecutive days
    const streakCheck = await db.query(
      `SELECT COUNT(DISTINCT session_date)::int AS consecutive_days
       FROM daily_session_log
       WHERE student_id = $1 
         AND session_date >= CURRENT_DATE - INTERVAL '7 days'
         AND is_rest_day = FALSE`,
      [userId]
    );

    let burnoutWarning = null;
    const consecutiveDays = streakCheck.rows[0]?.consecutive_days || 0;
    if (consecutiveDays >= 7) {
      burnoutWarning = {
        flag: 'warning',
        consecutiveDays,
        message: 'You\'ve been studying 7+ days straight. Consider taking a rest day tomorrow!'
      };

      await db.query(
        `INSERT INTO burnout_checks (student_id, consecutive_active_days, flag_level, recommendation)
         VALUES ($1, $2, 'warning', $3)`,
        [userId, consecutiveDays, burnoutWarning.message]
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Session ended!',
      data: {
        sessionSummary: {
          duration: endedSession.actual_minutes,
          questionsAnswered: endedSession.questions_answered,
          questionsCorrect: endedSession.questions_correct,
          xpEarned: endedSession.xp_earned,
          scenesCompleted: endedSession.scenes_completed?.length || 0
        },
        mastery: masteryResult,
        burnoutWarning
      }
    });

  } catch (error) {
    console.error('❌ End session error:', error);
    res.status(500).json({ success: false, message: 'Error ending session' });
  }
});

// ============================================
// GET /mastery-check/:scheduleId
// ============================================
router.get('/mastery-check/:scheduleId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT chapters, current_chapter, mastery_gate, total_chapters
       FROM learning_schedules
       WHERE id = $1 AND student_id = $2`,
      [req.params.scheduleId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const { chapters, current_chapter, mastery_gate, total_chapters } = result.rows[0];
    const currentData = (chapters || []).find(c => c.chapter === current_chapter) || {};

    res.json({
      success: true,
      data: {
        currentChapter: current_chapter,
        totalChapters: total_chapters,
        chapterMastery: currentData.mastery || 0,
        masteryGate: mastery_gate,
        questionsAnswered: currentData.questionsAnswered || 0,
        questionsCorrect: currentData.questionsCorrect || 0,
        canAdvance: (currentData.mastery || 0) >= mastery_gate && (currentData.questionsAnswered || 0) >= 3,
        allChapters: chapters
      }
    });

  } catch (error) {
    console.error('❌ Mastery check error:', error);
    res.status(500).json({ success: false, message: 'Error checking mastery' });
  }
});

module.exports = router;