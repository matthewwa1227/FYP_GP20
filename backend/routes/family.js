// backend/routes/family.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Helper: Generate a clean 6-character code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper: Verify parent is linked to this student
async function verifyParentChildLink(parentId, studentId, client = db) {
  const result = await client.query(
    'SELECT id FROM family_links WHERE guardian_id = $1 AND student_id = $2',
    [parentId, studentId]
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------
// 1. STUDENT: Generate a Connection Code
// POST /api/family/generate-code
// ---------------------------------------------------------
router.post('/generate-code', async (req, res) => {
  const studentId = req.user.id;
  const userRole = req.user.role;

  try {
    if (userRole === 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Only students can generate invite codes'
      });
    }

    await db.query(
      'UPDATE connection_codes SET used = true WHERE student_id = $1 AND used = false',
      [studentId]
    );

    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO connection_codes (code, student_id, expires_at, used)
       VALUES ($1, $2, $3, false)
       RETURNING code, expires_at`,
      [code, studentId, expiresAt]
    );

    res.status(201).json({
      success: true,
      code: result.rows[0].code,
      expiresAt: result.rows[0].expires_at,
      expiresInMinutes: 15
    });
  } catch (err) {
    console.error('❌ Generate Code Error:', err);
    res.status(500).json({ success: false, message: 'Server error generating code' });
  }
});

// ---------------------------------------------------------
// 2. PARENT: Link to Student using Code (with transaction)
// POST /api/family/link-child
// ---------------------------------------------------------
router.post('/link-child', async (req, res) => {
  const parentId = req.user.id;
  const userRole = req.user.role;
  const { code, relationship = 'Guardian' } = req.body;

  console.log('🔗 Link attempt:', { parentId, userRole, code, relationship });

  if (!code) {
    return res.status(400).json({ success: false, message: 'Code is required' });
  }

  if (userRole !== 'parent') {
    return res.status(403).json({
      success: false,
      message: 'Only parent accounts can link to students'
    });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const codeRes = await client.query(
      `SELECT id, student_id, expires_at, used 
       FROM connection_codes 
       WHERE code = $1`,
      [code.toUpperCase().trim()]
    );

    console.log('📝 Code lookup result:', codeRes.rows.length, 'rows found');

    if (codeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }

    const codeRecord = codeRes.rows[0];

    if (codeRecord.used) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Code has already been used' });
    }

    if (new Date() > new Date(codeRecord.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Code has expired' });
    }

    const existingLink = await client.query(
      `SELECT id FROM family_links WHERE guardian_id = $1 AND student_id = $2`,
      [parentId, codeRecord.student_id]
    );

    if (existingLink.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You are already linked to this student'
      });
    }

    await client.query(
      `INSERT INTO family_links (guardian_id, student_id, relationship)
       VALUES ($1, $2, $3)`,
      [parentId, codeRecord.student_id, relationship]
    );

    await client.query(
      'UPDATE connection_codes SET used = true WHERE id = $1',
      [codeRecord.id]
    );

    const studentRes = await client.query(
      `SELECT id, full_name, username, level 
       FROM students WHERE id = $1`,
      [codeRecord.student_id]
    );

    await client.query('COMMIT');

    const student = studentRes.rows[0];

    console.log('✅ Successfully linked parent to student:', student.username);

    res.status(201).json({
      success: true,
      student: {
        id: student.id,
        fullName: student.full_name || student.username,
        username: student.username,
        level: student.level || 1
      },
      message: `Successfully linked to ${student.full_name || student.username}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Link Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error linking account',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// 3. PARENT: Get list of linked students with stats
// GET /api/family/children-stats
// ---------------------------------------------------------
router.get('/children-stats', async (req, res) => {
  const parentId = req.user.id;

  console.log(`🔍 Fetching children for parent ID: ${parentId}`);

  try {
    const result = await db.query(
      `SELECT 
        s.id,
        s.full_name,
        s.username,
        s.level,
        s.xp,
        s.current_streak,
        s.total_study_time,
        s.form_level,
        s.age_tier,
        s.daily_time_limit_minutes,
        s.onboarding_completed,
        fl.relationship,
        fl.created_at as connected_at,
        (SELECT COUNT(*) FROM learning_schedules ls 
          WHERE ls.student_id = s.id AND ls.status = 'active')::int AS active_schedules,
        (SELECT COALESCE(SUM(dsl.actual_minutes), 0) FROM daily_session_log dsl 
          WHERE dsl.student_id = s.id AND dsl.session_date = CURRENT_DATE)::int AS today_minutes
       FROM family_links fl
       JOIN students s ON s.id = fl.student_id
       WHERE fl.guardian_id = $1
       ORDER BY fl.created_at DESC`,
      [parentId]
    );

    console.log(`✅ Found ${result.rows.length} children`);

    const children = result.rows.map(row => ({
      id: row.id,
      fullName: row.full_name || row.username,
      username: row.username,
      level: row.level || 1,
      xp: row.xp || 0,
      currentStreak: row.current_streak || 0,
      totalStudyTime: row.total_study_time || 0,
      relationship: row.relationship || 'Guardian',
      connectedAt: row.connected_at,
      formLevel: row.form_level,
      ageTier: row.age_tier,
      dailyTimeLimit: row.daily_time_limit_minutes,
      onboardingCompleted: row.onboarding_completed,
      activeSchedules: row.active_schedules,
      todayMinutes: row.today_minutes
    }));

    res.json({ success: true, children });
  } catch (err) {
    console.error('❌ Children Stats Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching children stats',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ---------------------------------------------------------
// 4. STUDENT: Get list of connected guardians
// GET /api/family/guardians
// ---------------------------------------------------------
router.get('/guardians', async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await db.query(
      `SELECT 
        fl.id as link_id,
        fl.guardian_id,
        s.full_name,
        s.username,
        s.email,
        fl.relationship,
        fl.created_at as connected_at
       FROM family_links fl
       JOIN students s ON s.id = fl.guardian_id
       WHERE fl.student_id = $1
       ORDER BY fl.created_at DESC`,
      [studentId]
    );

    const guardians = result.rows.map(row => ({
      linkId: row.link_id,
      guardianId: row.guardian_id,
      name: row.full_name || row.username,
      email: row.email,
      relationship: row.relationship || 'Guardian',
      connectedAt: row.connected_at
    }));

    res.json({ success: true, guardians });
  } catch (err) {
    console.error('❌ Get Guardians Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching guardians' });
  }
});

// ---------------------------------------------------------
// 5. STUDENT: Remove a guardian link
// DELETE /api/family/guardians/:linkId
// ---------------------------------------------------------
router.delete('/guardians/:linkId', async (req, res) => {
  const studentId = req.user.id;
  const { linkId } = req.params;

  try {
    const linkResult = await db.query(
      'SELECT id, student_id FROM family_links WHERE id = $1',
      [linkId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    if (linkResult.rows[0].student_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only remove your own guardian links'
      });
    }

    await db.query('DELETE FROM family_links WHERE id = $1', [linkId]);

    res.json({ success: true, message: 'Guardian removed successfully' });
  } catch (err) {
    console.error('❌ Remove Guardian Error:', err);
    res.status(500).json({ success: false, message: 'Error removing guardian' });
  }
});

// ---------------------------------------------------------
// 6. PARENT: Remove a child link
// DELETE /api/family/children/:studentId
// ---------------------------------------------------------
router.delete('/children/:studentId', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM family_links WHERE guardian_id = $1 AND student_id = $2 RETURNING id',
      [parentId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    res.json({ success: true, message: 'Child removed successfully' });
  } catch (err) {
    console.error('❌ Remove Child Error:', err);
    res.status(500).json({ success: false, message: 'Error removing child' });
  }
});

// =========================================================
// PHASE 2: PARENT SCHEDULE CONTROLS
// =========================================================

// ---------------------------------------------------------
// 7. PARENT: View child's learning schedules
// GET /api/family/children/:studentId/schedules
// ---------------------------------------------------------
router.get('/children/:studentId/schedules', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;

  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Parents only' });
    }

    const isLinked = await verifyParentChildLink(parentId, studentId);
    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not linked to this student'
      });
    }

    const result = await db.query(
      `SELECT 
        ls.*,
        COALESCE(
          (SELECT SUM(dsl.actual_minutes) FROM daily_session_log dsl 
           WHERE dsl.schedule_id = ls.id), 0
        )::int AS total_session_minutes,
        COALESCE(
          (SELECT SUM(dsl.actual_minutes) FROM daily_session_log dsl 
           WHERE dsl.schedule_id = ls.id AND dsl.session_date = CURRENT_DATE), 0
        )::int AS today_minutes,
        (SELECT COUNT(*) FROM daily_session_log dsl 
         WHERE dsl.schedule_id = ls.id)::int AS total_sessions
       FROM learning_schedules ls
       WHERE ls.student_id = $1
       ORDER BY 
         CASE ls.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
         ls.updated_at DESC`,
      [studentId]
    );

    const schedules = result.rows.map(row => ({
      id: row.id,
      topic: row.topic,
      subject: row.subject || 'General',
      formLevel: row.form_level,
      ageTier: row.age_tier,
      totalChapters: row.total_chapters,
      currentChapter: row.current_chapter,
      chapters: row.chapters,
      overallMastery: parseFloat(row.overall_mastery || 0),
      masteryGate: row.mastery_gate,
      totalQuestionsAnswered: row.total_questions_answered,
      totalQuestionsCorrect: row.total_questions_correct,
      totalTimeSpent: row.total_session_minutes,
      todayMinutes: row.today_minutes,
      totalSessions: row.total_sessions,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ success: true, data: schedules });
  } catch (err) {
    console.error('❌ Parent view schedules error:', err);
    res.status(500).json({ success: false, message: 'Error fetching child schedules' });
  }
});

// ---------------------------------------------------------
// 8. PARENT: View child's detailed mastery report
// GET /api/family/children/:studentId/mastery
// ---------------------------------------------------------
router.get('/children/:studentId/mastery', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;

  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Parents only' });
    }

    const isLinked = await verifyParentChildLink(parentId, studentId);
    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not linked to this student'
      });
    }

    // Get student info
    const studentResult = await db.query(
      `SELECT id, full_name, username, form_level, age_tier, 
              daily_time_limit_minutes, level, xp, current_streak
       FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = studentResult.rows[0];

    // Get schedules — compute question totals from daily_session_log
    const schedulesResult = await db.query(
      `SELECT 
        ls.id, 
        ls.topic, 
        COALESCE(ls.subject, 'General') AS subject,
        ls.chapters, 
        ls.current_chapter, 
        ls.total_chapters,
        ls.overall_mastery, 
        ls.mastery_gate, 
        ls.status, 
        ls.created_at,
        COALESCE(ls.total_time_spent_minutes, 0) AS total_time_spent_minutes,
        COALESCE(
          (SELECT SUM(dsl.questions_answered) FROM daily_session_log dsl 
           WHERE dsl.schedule_id = ls.id), 0
        )::int AS total_questions_answered,
        COALESCE(
          (SELECT SUM(dsl.questions_correct) FROM daily_session_log dsl 
           WHERE dsl.schedule_id = ls.id), 0
        )::int AS total_questions_correct
       FROM learning_schedules ls
       WHERE ls.student_id = $1 AND ls.status IN ('active', 'completed')
       ORDER BY ls.updated_at DESC`,
      [studentId]
    );

    // Get last 7 days of session activity
    const weeklyActivity = await db.query(
      `SELECT 
        session_date,
        COALESCE(SUM(actual_minutes), 0)::int AS minutes,
        COALESCE(SUM(questions_answered), 0)::int AS questions,
        COALESCE(SUM(questions_correct), 0)::int AS correct,
        COALESCE(SUM(xp_earned), 0)::int AS xp
       FROM daily_session_log
       WHERE student_id = $1 
         AND session_date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY session_date
       ORDER BY session_date DESC`,
      [studentId]
    );

    // Get burnout flags (safe — won't crash if table is empty or missing)
    let burnoutAlert = null;
    try {
      const burnoutResult = await db.query(
        `SELECT flag_level, recommendation, check_date
         FROM burnout_checks
         WHERE student_id = $1 AND acknowledged = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [studentId]
      );
      burnoutAlert = burnoutResult.rows[0] || null;
    } catch (burnoutErr) {
      console.warn('⚠️ Burnout query failed:', burnoutErr.message);
      burnoutAlert = null;
    }

    res.json({
      success: true,
      data: {
        student: {
          name: student.full_name || student.username,
          formLevel: student.form_level,
          ageTier: student.age_tier,
          dailyTimeLimit: student.daily_time_limit_minutes,
          level: student.level,
          xp: student.xp,
          streak: student.current_streak
        },
        schedules: schedulesResult.rows.map(s => ({
          id: s.id,
          topic: s.topic,
          subject: s.subject,
          currentChapter: s.current_chapter,
          totalChapters: s.total_chapters,
          overallMastery: parseFloat(s.overall_mastery || 0),
          masteryGate: s.mastery_gate,
          accuracy: s.total_questions_answered > 0
            ? Math.round((s.total_questions_correct / s.total_questions_answered) * 100)
            : 0,
          totalQuestions: s.total_questions_answered,
          totalTime: s.total_time_spent_minutes,
          chapters: s.chapters,
          status: s.status
        })),
        weeklyActivity: weeklyActivity.rows,
        burnoutAlert
      }
    });
  } catch (err) {
    console.error('❌ Parent mastery report error:', err);
    res.status(500).json({ success: false, message: 'Error fetching mastery report' });
  }
});

// ---------------------------------------------------------
// 9. PARENT: Adjust child's daily time limit
// PATCH /api/family/children/:studentId/time-limit
// ---------------------------------------------------------
router.patch('/children/:studentId/time-limit', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;
  const { dailyMinutes } = req.body;

  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Parents only' });
    }

    const isLinked = await verifyParentChildLink(parentId, studentId);
    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not linked to this student'
      });
    }

    if (!dailyMinutes || typeof dailyMinutes !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'dailyMinutes is required and must be a number'
      });
    }

    const clamped = Math.max(10, Math.min(120, Math.round(dailyMinutes)));

    const current = await db.query(
      'SELECT daily_time_limit_minutes, age_tier FROM students WHERE id = $1',
      [studentId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const previousLimit = current.rows[0].daily_time_limit_minutes;

    await db.query(
      'UPDATE students SET daily_time_limit_minutes = $1 WHERE id = $2',
      [clamped, studentId]
    );

    console.log(`⏱️ Parent ${parentId} changed time limit for student ${studentId}: ${previousLimit} → ${clamped} min`);

    res.json({
      success: true,
      message: `Daily time limit updated to ${clamped} minutes`,
      data: {
        previousLimit,
        newLimit: clamped,
        ageTier: current.rows[0].age_tier
      }
    });
  } catch (err) {
    console.error('❌ Time limit update error:', err);
    res.status(500).json({ success: false, message: 'Error updating time limit' });
  }
});

// ---------------------------------------------------------
// 10. PARENT: Force a rest day for today
// POST /api/family/children/:studentId/rest-day
// ---------------------------------------------------------
router.post('/children/:studentId/rest-day', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;
  const { date } = req.body;

  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Parents only' });
    }

    const isLinked = await verifyParentChildLink(parentId, studentId);
    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not linked to this student'
      });
    }

    const restDate = date || new Date().toISOString().split('T')[0];

    // Check if there's already a session today
    const existing = await db.query(
      `SELECT id FROM daily_session_log 
       WHERE student_id = $1 AND session_date = $2`,
      [studentId, restDate]
    );

    if (existing.rows.length > 0) {
      // Mark existing sessions as rest day, end them if still open
      await db.query(
        `UPDATE daily_session_log 
         SET session_ended_at = COALESCE(session_ended_at, NOW()),
             is_rest_day = TRUE
         WHERE student_id = $1 AND session_date = $2`,
        [studentId, restDate]
      );
    } else {
      // Insert a rest day marker — NO session_started_at (doesn't exist in your table)
      await db.query(
        `INSERT INTO daily_session_log (
          student_id, session_date, session_ended_at,
          planned_minutes, actual_minutes, is_rest_day
        ) VALUES ($1, $2, NOW(), 0, 0, TRUE)`,
        [studentId, restDate]
      );
    }

    console.log(`😴 Parent ${parentId} set rest day for student ${studentId} on ${restDate}`);

    res.json({
      success: true,
      message: `Rest day set for ${restDate}. Your child won't be able to start new sessions.`,
      data: { restDate }
    });
  } catch (err) {
    console.error('❌ Rest day error:', err);
    res.status(500).json({ success: false, message: 'Error setting rest day' });
  }
});

// ---------------------------------------------------------
// 11. PARENT: Acknowledge a burnout warning
// PATCH /api/family/children/:studentId/burnout-ack
// ---------------------------------------------------------
router.patch('/children/:studentId/burnout-ack', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;

  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Parents only' });
    }

    const isLinked = await verifyParentChildLink(parentId, studentId);
    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not linked to this student'
      });
    }

    const result = await db.query(
      `UPDATE burnout_checks 
       SET acknowledged = TRUE
       WHERE student_id = $1 AND acknowledged = FALSE
       RETURNING id`,
      [studentId]
    );

    res.json({
      success: true,
      message: `${result.rowCount} burnout alert(s) acknowledged`
    });
  } catch (err) {
    console.error('❌ Burnout ack error:', err);
    res.status(500).json({ success: false, message: 'Error acknowledging burnout alert' });
  }
});

module.exports = router;