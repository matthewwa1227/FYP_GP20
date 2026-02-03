const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// ============================================
// STUDY BUDDY ROUTES
// ============================================

// Chat with Study Buddy
router.post('/chat', aiController.chatWithBuddy);

// Generate optimized study schedule
router.post('/generate-schedule', aiController.generateSchedule);

// Get study tips
router.get('/tips', aiController.getStudyTips);

// Get conversation history
router.get('/history', aiController.getConversationHistory);

// Get scheduled sessions
router.get('/sessions', aiController.getScheduledSessions);

// ============================================
// STORY QUEST ROUTES
// ============================================

// Generate story introduction
router.post('/story/intro', aiController.generateStoryIntroduction);

// Generate story scene (narrative, dialogue, choice, reward, finale)
router.post('/story/scene', aiController.generateScene);

// Generate lesson content
router.post('/story/lesson', aiController.generateLesson);

// Generate question
router.post('/story/question', aiController.generateQuestion);

// Save story progress (optional)
router.post('/story/progress', aiController.saveStoryProgress);

// Get story progress (optional)
router.get('/story/progress', aiController.getStoryProgress);

module.exports = router;