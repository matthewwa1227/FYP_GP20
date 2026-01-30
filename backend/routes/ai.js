const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

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

module.exports = router;