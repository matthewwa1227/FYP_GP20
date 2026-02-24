const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');
const { checkScheduleLimits } = require('../middleware/scheduleGuard');

// Apply authentication to all routes
router.use(authenticateToken);

// ============================================
// STORY QUEST ROUTES - Protected by schedule limits
// ============================================

// Generate story introduction
router.post('/story/intro', checkScheduleLimits, aiController.generateStoryIntroduction);

// Generate story scene (narrative, dialogue, choice, reward, finale)
router.post('/story/scene', checkScheduleLimits, aiController.generateScene);

// Generate lesson content
router.post('/story/lesson', checkScheduleLimits, aiController.generateLesson);

// Generate question
router.post('/story/question', checkScheduleLimits, aiController.generateQuestion);

// Save/Get story progress - No schedule limits needed (just data persistence)
router.post('/story/progress', aiController.saveStoryProgress);
router.get('/story/progress', aiController.getStoryProgress);

module.exports = router;
