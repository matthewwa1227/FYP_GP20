// routes/aiStory.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkScheduleLimits } = require('../middleware/scheduleGuard');
const db = require('../db/connection');
const {
  generateStoryIntro,
  generateStoryScene,
  generateStoryLesson,
  generateStoryQuestion
} = require('../services/kimiService');

console.log('📖 Story Quest routes loaded (schedule-aware)');

// ============================================
// Helper: log scene/question to active session
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

    const intro = await generateStoryIntro(topic.trim());

    await logToActiveSession(req.user.id, 'intro', 10);

    console.log('✅ Intro generated:', intro?.title);
    res.json({
      ...intro,
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Story intro error:', error.message);
    res.json({
      title: `The ${req.body.topic || 'Learning'} Chronicles`,
      setting: `In the mystical Library of Infinite Knowledge, ancient tomes containing the secrets of ${req.body.topic || 'knowledge'} await those brave enough to seek them.`,
      mentor_intro: `"Welcome, young scholar! I am Archimedes, keeper of wisdom. Are you ready to begin your journey?"`,
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
    const scene = await generateStoryScene(topic, chapter, sceneType, context || {});

    await logToActiveSession(req.user.id, `scene_${sceneType}`, 5);

    console.log('✅ Scene generated:', scene?.type);
    res.json({
      ...scene,
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo.remaining,
        shouldWarnSoon: req.scheduleInfo.shouldWarnSoon
      }
    });

  } catch (error) {
    console.error('❌ Scene generation error:', error.message);
    res.json({
      type: req.body.sceneType || 'narrative',
      text: `Your journey through ${req.body.topic || 'knowledge'} continues...`,
      speaker: 'Archimedes',
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
    const lesson = await generateStoryLesson(topic, chapter, conceptNumber || 1);

    await logToActiveSession(req.user.id, `lesson_${conceptNumber || 1}`, 15);

    console.log('✅ Lesson generated:', lesson?.title);
    res.json({
      ...lesson,
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
      text: `Welcome to this lesson about ${req.body.topic || 'your subject'}! Understanding the basics will help you master more advanced topics later.\n\nThink of learning like building a tower - each block of knowledge supports the next.`,
      keyPoint: 'Practice and patience are key to mastery.',
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
    const { topic, difficulty, questionType, previousQuestions, conceptTitle } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`❓ Generating question for ${topic}, difficulty ${difficulty || 1}`);

    const question = await generateStoryQuestion(
      topic,
      difficulty || 1,
      questionType || 'multiple_choice',
      previousQuestions || [],
      conceptTitle
    );

    // Don't log mastery here — the frontend sends the answer result
    // to PATCH /schedule/log-progress after the student answers
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
      text: `What is essential for mastering ${req.body.topic || 'this subject'}?`,
      choices: [
        { text: 'Consistent practice and understanding concepts', correct: true },
        { text: 'Memorizing without understanding', correct: false },
        { text: 'Skipping the fundamentals', correct: false },
        { text: 'Avoiding challenging problems', correct: false }
      ].sort(() => Math.random() - 0.5),
      explanation: `Consistent practice combined with conceptual understanding is the key to mastering ${req.body.topic || 'any subject'}.`,
      xp: 25 + ((req.body.difficulty || 1) * 10),
      _scheduleInfo: {
        timeRemaining: req.scheduleInfo?.remaining,
        shouldWarnSoon: req.scheduleInfo?.shouldWarnSoon
      }
    });
  }
});

module.exports = router;