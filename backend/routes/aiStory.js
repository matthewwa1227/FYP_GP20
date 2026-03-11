// routes/aiStory.js
// The Procrastination Prophecy - AI Story Quest Routes

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkScheduleLimits } = require('../middleware/scheduleGuard');
const db = require('../db/connection');
const {
  generateStoryIntro,
  generateStoryScene,
  generateStoryLesson,
  generateStoryQuestion,
  generateStudyJourney,
  getNarrativeMessage
} = require('../services/kimiService');

console.log('📖 Story Quest routes loaded (Procrastination Prophecy)');

// ============================================
// Helper: Get hero context for narrative
// ============================================
async function getHeroContext(studentId) {
  try {
    // Get student streak and hero journey data
    const result = await db.query(`
      SELECT 
        s.current_streak,
        s.total_study_minutes,
        COALESCE(hj.hero_power, 10) as hero_power,
        COALESCE(hj.shadow_doom_level, 0) as shadow_doom,
        COALESCE(hj.current_stage, 1) as current_stage,
        COALESCE(hj.shadow_doom_active, false) as shadow_active
      FROM students s
      LEFT JOIN hero_journeys hj ON s.id = hj.student_id
      WHERE s.id = $1
    `, [studentId]);

    if (result.rows.length === 0) {
      return {
        streakDays: 0,
        heroPower: 10,
        shadowDoom: 0,
        currentStage: 1,
        shadowActive: false,
        totalMinutes: 0
      };
    }

    const row = result.rows[0];
    return {
      streakDays: row.current_streak || 0,
      heroPower: row.hero_power || 10,
      shadowDoom: row.shadow_doom || 0,
      currentStage: row.current_stage || 1,
      shadowActive: row.shadow_active || false,
      totalMinutes: row.total_study_minutes || 0
    };
  } catch (err) {
    console.error('Error getting hero context:', err.message);
    return {
      streakDays: 0,
      heroPower: 10,
      shadowDoom: 0,
      currentStage: 1,
      shadowActive: false,
      totalMinutes: 0
    };
  }
}

// ============================================
// Helper: Get tier info from user
// ============================================
function getTierInfo(user) {
  if (!user || !user.ageTier) return null;
  return {
    ageTier: user.ageTier,
    formLevel: user.formLevel
  };
}

// ============================================
// Helper: Log scene to active session
// ============================================
async function logToActiveSession(userId, sceneType, xpEarned = 0) {
  try {
    await db.query(
      `UPDATE daily_session_log 
       SET scenes_completed = array_append(scenes_completed, $1),
           xp_earned = xp_earned + $2,
           actual_minutes = GREATEST(
             actual_minutes,
             EXTRACT(EPOCH FROM (NOW() - session_started_at))::int / 60
           )
       WHERE student_id = $3 
         AND session_date = CURRENT_DATE 
         AND session_ended_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [sceneType, xpEarned, userId]
    );
  } catch (err) {
    console.log('Note: Could not log to active session:', err.message);
  }
}

// ============================================
// GET /hero-status - Get hero power and shadow doom status
// ============================================
router.get('/hero-status', authenticateToken, async (req, res) => {
  console.log('🦸 /hero-status endpoint hit');

  try {
    const heroContext = await getHeroContext(req.user.id);
    
    // Get today's journey log
    const todayLog = await db.query(`
      SELECT studied_today, minutes_studied, hero_power_gained, shadow_grew
      FROM journey_logs
      WHERE student_id = $1 AND log_date = CURRENT_DATE
    `, [req.user.id]);

    // Get narrative messages
    const heroMessage = getNarrativeMessage('hero_power', heroContext.heroPower);
    const shadowMessage = getNarrativeMessage('shadow_warning', heroContext.shadowDoom);

    // Get current stage info
    const stageInfo = await db.query(`
      SELECT * FROM journey_stages WHERE stage_number = $1
    `, [heroContext.currentStage]);

    res.json({
      success: true,
      hero: {
        power: heroContext.heroPower,
        powerMax: 100,
        streakDays: heroContext.streakDays,
        message: heroMessage
      },
      shadow: {
        level: heroContext.shadowDoom,
        levelMax: 100,
        active: heroContext.shadowActive,
        message: shadowMessage
      },
      journey: {
        currentStage: heroContext.currentStage,
        totalStages: 10,
        stageInfo: stageInfo.rows[0] || null,
        totalMinutes: heroContext.totalMinutes
      },
      today: todayLog.rows[0] || {
        studied_today: false,
        minutes_studied: 0,
        hero_power_gained: 0,
        shadow_grew: false
      }
    });

  } catch (error) {
    console.error('❌ Hero status error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get hero status'
    });
  }
});

// ============================================
// GET /journey - Get full study journey path
// ============================================
router.get('/journey', authenticateToken, async (req, res) => {
  console.log('🗺️ /journey endpoint hit');

  try {
    const heroContext = await getHeroContext(req.user.id);
    
    // Get all journey stages
    const stagesResult = await db.query(`
      SELECT * FROM journey_stages ORDER BY stage_number ASC
    `);

    // Get completed milestones for this user
    const journeyResult = await db.query(`
      SELECT milestones_completed, chosen_path FROM hero_journeys WHERE student_id = $1
    `, [req.user.id]);

    const completedMilestones = journeyResult.rows[0]?.milestones_completed || [];
    const chosenPath = journeyResult.rows[0]?.chosen_path || null;

    // Mark stages as completed based on streak/hero power
    const stages = stagesResult.rows.map(stage => ({
      ...stage,
      completed: completedMilestones.includes(stage.title) || 
                 heroContext.streakDays >= stage.required_streak_days ||
                 heroContext.totalMinutes >= stage.required_total_minutes,
      unlocked: heroContext.currentStage >= stage.stage_number ||
                heroContext.streakDays >= stage.required_streak_days - 1
    }));

    res.json({
      success: true,
      journey: {
        title: 'The Path of the Scholar',
        subtitle: 'Conquer the Procrastination Prophecy',
        currentStage: heroContext.currentStage,
        chosenPath: chosenPath,
        stages: stages
      },
      hero: {
        power: heroContext.heroPower,
        streak: heroContext.streakDays
      }
    });

  } catch (error) {
    console.error('❌ Journey error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get journey'
    });
  }
});

// ============================================
// GET /journey/:stage - Get specific stage details
// ============================================
router.get('/journey/:stage', authenticateToken, async (req, res) => {
  const stageNum = parseInt(req.params.stage);
  console.log(`🗺️ /journey/${stageNum} endpoint hit`);

  try {
    const tierInfo = getTierInfo(req.user);
    const stageData = await generateStudyJourney(req.user.id, stageNum, tierInfo);
    
    res.json({
      success: true,
      stage: stageData
    });

  } catch (error) {
    console.error('❌ Stage error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get stage'
    });
  }
});

// ============================================
// POST /choose-path - Choose hero path (wisdom/courage/creativity)
// ============================================
router.post('/choose-path', authenticateToken, async (req, res) => {
  console.log('🛤️ /choose-path endpoint hit');
  const { path } = req.body;

  if (!path || !['wisdom', 'courage', 'creativity'].includes(path)) {
    return res.status(400).json({
      success: false,
      error: 'Path must be wisdom, courage, or creativity'
    });
  }

  try {
    await db.query(`
      INSERT INTO hero_journeys (student_id, chosen_path, hero_power)
      VALUES ($1, $2, 15)
      ON CONFLICT (student_id) 
      DO UPDATE SET chosen_path = $2, hero_power = hero_journeys.hero_power + 5
    `, [req.user.id, path]);

    res.json({
      success: true,
      message: `You have chosen the path of ${path}!`,
      path: path,
      bonus: '+5 Hero Power'
    });

  } catch (error) {
    console.error('❌ Choose path error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to choose path'
    });
  }
});

// ============================================
// POST /intro — Generate story introduction
// ============================================
router.post('/intro', authenticateToken, checkScheduleLimits, async (req, res) => {
  console.log('🎮 /intro endpoint hit (schedule-aware)');

  try {
    const { topic } = req.body;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`📖 Generating story intro for topic: ${topic} (${req.scheduleInfo.ageTier})`);

    const tierInfo = getTierInfo(req.user);
    const heroContext = await getHeroContext(req.user.id);
    
    const intro = await generateStoryIntro(topic.trim(), tierInfo, heroContext);

    await logToActiveSession(req.user.id, 'intro', 10);

    console.log('✅ Intro generated:', intro?.title);
    res.json({
      ...intro,
      heroContext: {
        power: heroContext.heroPower,
        streak: heroContext.streakDays,
        shadow: heroContext.shadowDoom
      },
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Story intro error:', error.message);
    const heroContext = await getHeroContext(req.user.id);
    res.json({
      title: `The ${req.body.topic || 'Learning'} Quest`,
      setting: `The world needs heroes who know ${req.body.topic || 'knowledge'}. The Shadow of Doom spreads ignorance. You must learn to fight back!`,
      mentor_intro: `"Welcome, Hero! I am your guide. Learning will make you stronger. Let's push back the Shadow together!"`,
      hero_message: 'Every lesson makes you stronger!',
      shadow_status: heroContext.shadowDoom > 30 ? 'The Shadow grows... Study to push it back!' : '',
      heroContext: {
        power: heroContext.heroPower,
        streak: heroContext.streakDays,
        shadow: heroContext.shadowDoom
      },
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo?.remaining,
        shouldWarnSoon: req.scheduleInfo?.shouldWarnSoon
      }
    });
  }
});

// ============================================
// POST /scene — Generate a story scene
// ============================================
router.post('/scene', authenticateToken, checkScheduleLimits, async (req, res) => {
  console.log('🎭 /scene endpoint hit (schedule-aware)');

  try {
    const { topic, chapter, sceneType, context } = req.body;

    if (!topic || !chapter || !sceneType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🎭 Generating ${sceneType} scene for chapter ${chapter}`);
    
    const tierInfo = getTierInfo(req.user);
    const heroContext = await getHeroContext(req.user.id);
    
    const scene = await generateStoryScene(topic, chapter, sceneType, {
      ...context,
      tierInfo,
      heroContext
    });

    await logToActiveSession(req.user.id, `scene_${sceneType}`, 5);

    console.log('✅ Scene generated:', scene?.type);
    res.json({
      ...scene,
      heroContext: {
        power: heroContext.heroPower,
        streak: heroContext.streakDays
      },
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Scene generation error:', error.message);
    res.json({
      type: req.body.sceneType || 'narrative',
      text: `Your journey continues...`,
      speaker: 'Guide',
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo?.remaining,
        shouldWarnSoon: req.scheduleInfo?.shouldWarnSoon
      }
    });
  }
});

// ============================================
// POST /lesson — Generate a teaching lesson
// ============================================
router.post('/lesson', authenticateToken, checkScheduleLimits, async (req, res) => {
  console.log('📚 /lesson endpoint hit (schedule-aware)');

  try {
    const { topic, chapter, conceptNumber } = req.body;

    if (!topic || !chapter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📚 Generating lesson ${conceptNumber || 1} for ${topic} chapter ${chapter}`);
    
    const tierInfo = getTierInfo(req.user);
    const heroContext = await getHeroContext(req.user.id);
    
    const lesson = await generateStoryLesson(topic, chapter, conceptNumber || 1, tierInfo, heroContext);

    await logToActiveSession(req.user.id, `lesson_${conceptNumber || 1}`, 15);

    console.log('✅ Lesson generated:', lesson?.title);
    res.json({
      ...lesson,
      heroContext: {
        power: heroContext.heroPower,
        streak: heroContext.streakDays
      },
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Lesson generation error:', error.message);
    res.json({
      type: 'lesson',
      title: `${req.body.topic || 'Subject'} Fundamentals`,
      text: `Welcome! Understanding the basics will help you master more advanced topics.\n\nTake your time and make sure you understand each concept.`,
      keyPoint: 'Practice makes you stronger.',
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo?.remaining,
        shouldWarnSoon: req.scheduleInfo?.shouldWarnSoon
      }
    });
  }
});

// ============================================
// POST /question — Generate a quiz question
// ============================================
router.post('/question', authenticateToken, checkScheduleLimits, async (req, res) => {
  console.log('❓ /question endpoint hit (schedule-aware)');

  try {
    const { topic, subject, chapterTitle, difficulty, questionType, previousQuestions, conceptTitle } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const actualSubject = subject || topic;
    console.log(`❓ Generating question for ${topic} (Subject: ${actualSubject}), difficulty ${difficulty || 1}`);

    const tierInfo = getTierInfo(req.user);
    
    const question = await generateStoryQuestion(
      topic,
      difficulty || 1,
      questionType || 'multiple_choice',
      previousQuestions || [],
      conceptTitle || chapterTitle,
      tierInfo,
      actualSubject // Pass subject context
    );

    await logToActiveSession(req.user.id, 'question', 0);

    console.log('✅ Question generated');
    res.json({
      ...question,
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Question generation error:', error.message);
    res.json({
      type: 'question',
      text: `What is the best way to learn ${req.body.topic || 'this subject'}?`,
      choices: [
        { text: 'Practice every day', correct: true },
        { text: 'Study only before tests', correct: false },
        { text: 'Never review', correct: false },
        { text: 'Skip hard parts', correct: false }
      ].sort(() => Math.random() - 0.5),
      explanation: 'Daily practice helps you remember better.',
      xp: 25 + ((req.body.difficulty || 1) * 10),
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo?.remaining,
        shouldWarnSoon: req.scheduleInfo?.shouldWarnSoon
      }
    });
  }
});

// ============================================
// POST /narrative-event - Log a narrative event
// ============================================
router.post('/narrative-event', authenticateToken, async (req, res) => {
  console.log('📖 /narrative-event endpoint hit');
  const { eventType, eventTitle, eventDescription, heroPowerChange, shadowDoomChange } = req.body;

  try {
    await db.query(`
      INSERT INTO narrative_events 
      (student_id, event_type, event_title, event_description, hero_power_change, shadow_doom_change)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.user.id, eventType, eventTitle, eventDescription, heroPowerChange || 0, shadowDoomChange || 0]);

    res.json({ success: true, message: 'Event logged' });
  } catch (error) {
    console.error('❌ Narrative event error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to log event' });
  }
});

// ============================================
// GET /narrative-events - Get user's narrative history
// ============================================
router.get('/narrative-events', authenticateToken, async (req, res) => {
  console.log('📖 /narrative-events endpoint hit');

  try {
    const result = await db.query(`
      SELECT * FROM narrative_events 
      WHERE student_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [req.user.id]);

    res.json({
      success: true,
      events: result.rows
    });
  } catch (error) {
    console.error('❌ Narrative events error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get events' });
  }
});

// ============================================
// TEST ROUTES
// ============================================
router.get('/test-schedule-block/:type', authenticateToken, (req, res) => {
  const type = req.params.type;
  
  if (type === 'rest') {
    return res.status(403).json({
      code: 'REST_DAY',
      error: 'REST_DAY',
      type: 'REST_DAY',
      message: 'TEST: Today is a rest day'
    });
  }
  if (type === 'time') {
    return res.status(403).json({
      code: 'TIME_LIMIT_REACHED',
      error: 'TIME_LIMIT_REACHED', 
      type: 'TIME_LIMIT_REACHED',
      message: 'TEST: Time limit reached',
      remaining: 0
    });
  }
  if (type === 'onboarding') {
    return res.status(403).json({
      code: 'ONBOARDING_REQUIRED',
      error: 'ONBOARDING_REQUIRED',
      type: 'ONBOARDING_REQUIRED',
      message: 'TEST: Onboarding required'
    });
  }
  
  res.json({ message: 'No block', type });
});

// ============================================
// POST /schedule - Generate chapter schedule for topic
// ============================================
router.post('/schedule', authenticateToken, async (req, res) => {
  console.log('📅 /schedule endpoint hit');

  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`📅 Generating schedule for: ${topic}`);

    const prompt = `Create a 4-chapter learning schedule for "${topic}".

Return ONLY valid JSON in this exact format:
{
  "chapters": [
    {
      "title": "Chapter 1 Title",
      "focus": "What to learn in this chapter",
      "estimatedTime": "15 min"
    },
    {
      "title": "Chapter 2 Title", 
      "focus": "What to learn in this chapter",
      "estimatedTime": "20 min"
    },
    {
      "title": "Chapter 3 Title",
      "focus": "What to learn in this chapter", 
      "estimatedTime": "25 min"
    },
    {
      "title": "Chapter 4 Title",
      "focus": "What to learn in this chapter",
      "estimatedTime": "30 min"
    }
  ]
}

Make it progressive: Chapter 1 is foundation, Chapter 4 is mastery.
Use exciting chapter titles that sound like an RPG game.
Keep estimated times between 15-30 minutes.`;

    const { sendMessageToKimi } = require('../services/kimiService');
    
    let response;
    try {
      response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
        maxTokens: 800,
        useThinking: false  // Disable thinking for JSON responses
      });
    } catch (apiError) {
      console.error('API call failed, using fallback:', apiError.message);
      // Return fallback immediately if API fails
      return res.json({
        success: true,
        chapters: [
          { title: 'The Beginning', focus: 'Foundation Concepts', estimatedTime: '15 min' },
          { title: 'First Steps', focus: 'Core Principles', estimatedTime: '20 min' },
          { title: 'The Challenge', focus: 'Advanced Application', estimatedTime: '25 min' },
          { title: 'Mastery', focus: 'Expert Level', estimatedTime: '30 min' }
        ]
      });
    }

    // Try to parse JSON from response
    let parsed;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.log('Raw response:', response);
      // Use fallback
      parsed = {
        chapters: [
          { title: 'The Beginning', focus: 'Foundation Concepts', estimatedTime: '15 min' },
          { title: 'First Steps', focus: 'Core Principles', estimatedTime: '20 min' },
          { title: 'The Challenge', focus: 'Advanced Application', estimatedTime: '25 min' },
          { title: 'Mastery', focus: 'Expert Level', estimatedTime: '30 min' }
        ]
      };
    }
    
    console.log('✅ Schedule generated');
    res.json({
      success: true,
      ...parsed
    });

  } catch (error) {
    console.error('❌ Schedule generation error:', error.message);
    // Always return fallback on error
    res.json({
      success: true,
      chapters: [
        { title: 'The Beginning', focus: 'Foundation Concepts', estimatedTime: '15 min' },
        { title: 'First Steps', focus: 'Core Principles', estimatedTime: '20 min' },
        { title: 'The Challenge', focus: 'Advanced Application', estimatedTime: '25 min' },
        { title: 'Mastery', focus: 'Expert Level', estimatedTime: '30 min' }
      ]
    });
  }
});

module.exports = router;
