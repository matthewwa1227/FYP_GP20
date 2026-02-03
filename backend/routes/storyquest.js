const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Story Quest routes working' });
});

// ============================================
// GENERATE STORY INTRO
// ============================================
router.post('/intro', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`📖 Generating story intro for: ${topic}`);
    
    const intro = await kimiService.generateStoryIntro(topic.trim());
    
    res.json({ success: true, ...intro });
  } catch (error) {
    console.error('Story intro error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate intro' });
  }
});

// ============================================
// GENERATE SCENE
// ============================================
router.post('/scene', authenticateToken, async (req, res) => {
  try {
    const { topic, chapter, sceneType, context } = req.body;
    
    if (!topic || !sceneType) {
      return res.status(400).json({ success: false, message: 'Topic and sceneType required' });
    }

    console.log(`🎬 Generating ${sceneType} scene for ${topic} (Chapter ${chapter})`);
    
    const scene = await kimiService.generateStoryScene(topic, chapter || 1, sceneType, context || {});
    
    res.json({ success: true, ...scene });
  } catch (error) {
    console.error('Scene error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate scene' });
  }
});

// ============================================
// GENERATE LESSON
// ============================================
router.post('/lesson', authenticateToken, async (req, res) => {
  try {
    const { topic, chapter, conceptNumber } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`📚 Generating lesson for ${topic} (Chapter ${chapter}, Concept ${conceptNumber})`);
    
    const lesson = await kimiService.generateStoryLesson(topic, chapter || 1, conceptNumber || 1);
    
    res.json({ success: true, ...lesson });
  } catch (error) {
    console.error('Lesson error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate lesson' });
  }
});

// ============================================
// GENERATE QUESTION
// ============================================
router.post('/question', authenticateToken, async (req, res) => {
  try {
    const { topic, difficulty, questionType, previousQuestions, conceptTitle } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`❓ Generating question for ${topic} (difficulty: ${difficulty}, previous: ${previousQuestions?.length || 0})`);
    
    const question = await kimiService.generateStoryQuestion(
      topic,
      difficulty || 1,
      questionType || 'multiple_choice',
      previousQuestions || [],
      conceptTitle
    );
    
    res.json({ success: true, ...question });
  } catch (error) {
    console.error('Question error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate question' });
  }
});

module.exports = router;