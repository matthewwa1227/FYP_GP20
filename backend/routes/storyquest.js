const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');
const { query } = require('../db/connection');

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

// ============================================
// SIMPLE LEARN SCENE - One-call educational content
// ============================================
router.post('/learn', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.body;
    const studentId = req.user.id;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`📖 LearnScene: Generating content for topic: ${topic}`);

    const prompt = `Explain '${topic}' to a Hong Kong secondary student in 80 words. Use encouraging RPG narrator tone. Plain text only, no markdown.`;
    const content = await kimiService.sendMessageToKimi([{ role: 'user', content: prompt }], { maxTokens: 200 });

    // Log to ai_conversations table
    await query(
      `INSERT INTO ai_conversations (student_id, session_id, conversation_type, message_role, message_content, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [studentId, `learn_${Date.now()}`, 'learn_scene', 'assistant', content]
    );

    console.log(`✅ LearnScene: Content generated and logged for student ${studentId}`);

    res.json({ 
      success: true,
      content: content.trim(),
      topic: topic.trim()
    });
  } catch (error) {
    console.error('LearnScene error:', error);
    res.status(500).json({ 
      success: false,
      content: "The knowledge crystal is dim... Try again!", 
      topic: req.body?.topic || 'unknown'
    });
  }
});

module.exports = router;