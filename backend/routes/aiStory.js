const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  generateStoryIntro,
  generateStoryScene,
  generateStoryLesson,
  generateStoryQuestion
} = require('../services/kimiService');

// Debug: Log when routes are loaded
console.log('📖 Story Quest routes loaded');

// Generate story introduction
router.post('/intro', authenticateToken, async (req, res) => {
  console.log('🎮 /intro endpoint hit!');
  console.log('📝 Request body:', req.body);
  console.log('👤 User:', req.user?.id);
  
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim().length === 0) {
      console.log('❌ No topic provided');
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`📖 Generating story intro for topic: ${topic}`);
    
    const intro = await generateStoryIntro(topic.trim());
    
    console.log('✅ Intro generated:', intro?.title);
    res.json(intro);
    
  } catch (error) {
    console.error('❌ Story intro error:', error.message);
    res.json({ 
      title: `The ${req.body.topic || 'Learning'} Chronicles`,
      setting: `In the mystical Library of Infinite Knowledge, ancient tomes containing the secrets of ${req.body.topic || 'knowledge'} await those brave enough to seek them.`,
      mentor_intro: `"Welcome, young scholar! I am Archimedes, keeper of wisdom. Are you ready to begin your journey?"`
    });
  }
});

// Generate a story scene
router.post('/scene', authenticateToken, async (req, res) => {
  console.log('🎭 /scene endpoint hit!');
  console.log('📝 Request body:', req.body);
  
  try {
    const { topic, chapter, sceneType, context } = req.body;
    
    if (!topic || !chapter || !sceneType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🎭 Generating ${sceneType} scene for chapter ${chapter}`);
    const scene = await generateStoryScene(topic, chapter, sceneType, context || {});
    
    console.log('✅ Scene generated:', scene?.type);
    res.json(scene);
    
  } catch (error) {
    console.error('❌ Scene generation error:', error.message);
    res.json({ 
      type: req.body.sceneType || 'narrative',
      text: `Your journey through ${req.body.topic || 'knowledge'} continues...`,
      speaker: 'Archimedes'
    });
  }
});

// Generate a teaching lesson
router.post('/lesson', authenticateToken, async (req, res) => {
  console.log('📚 /lesson endpoint hit!');
  console.log('📝 Request body:', req.body);
  
  try {
    const { topic, chapter, conceptNumber } = req.body;
    
    if (!topic || !chapter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📚 Generating lesson ${conceptNumber || 1} for ${topic} chapter ${chapter}`);
    const lesson = await generateStoryLesson(topic, chapter, conceptNumber || 1);
    
    console.log('✅ Lesson generated:', lesson?.title);
    res.json(lesson);
    
  } catch (error) {
    console.error('❌ Lesson generation error:', error.message);
    res.json({
      type: 'lesson',
      title: `${req.body.topic || 'Subject'} Fundamentals`,
      text: `Welcome to this lesson about ${req.body.topic || 'your subject'}! Understanding the basics will help you master more advanced topics later.\n\nThink of learning like building a tower - each block of knowledge supports the next.`,
      keyPoint: 'Practice and patience are key to mastery.'
    });
  }
});

// Generate a quiz question
router.post('/question', authenticateToken, async (req, res) => {
  console.log('❓ /question endpoint hit!');
  console.log('📝 Request body:', req.body);
  
  try {
    const { topic, difficulty, questionType, previousQuestions, conceptTitle } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`❓ Generating question for ${topic}, difficulty ${difficulty || 1}, concept: ${conceptTitle || 'general'}`);
    console.log(`📋 Previous questions count: ${previousQuestions?.length || 0}`);
    
    const question = await generateStoryQuestion(
      topic,
      difficulty || 1,
      questionType || 'multiple_choice',
      previousQuestions || [],
      conceptTitle
    );
    
    console.log('✅ Question generated:', question?.text?.substring(0, 50) + '...');
    res.json(question);
    
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
      xp: 25 + ((req.body.difficulty || 1) * 10)
    });
  }
});

module.exports = router;