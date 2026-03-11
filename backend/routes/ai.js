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

// ============================================
// AI BUDDY CHAT - General study help
// ============================================
const kimiService = require('../services/kimiService');

router.post('/chat', async (req, res) => {
  try {
    const { message, context = [], media = [] } = req.body;
    
    if (!message && media.length === 0) {
      return res.status(400).json({ error: 'Message or media is required' });
    }

    console.log(`💬 Study Buddy chat: ${message?.substring(0, 50) || '[Media]'}...`);
    console.log(`📷 Media attachments: ${media.length}`);

    // Build content array (text + media)
    const content = [];
    
    if (message) {
      content.push({
        type: 'text',
        text: message
      });
    }
    
    // Add media (images and videos)
    let hasVideo = false;
    media.forEach(item => {
      if (item.type === 'image_url' && item.image_url?.url) {
        content.push({
          type: 'image_url',
          image_url: {
            url: item.image_url.url
          }
        });
      } else if (item.type === 'video_url' && item.video_url?.url) {
        // Note: Most AI APIs don't support direct video analysis
        // In production, you'd extract frames here
        hasVideo = true;
        // For now, we'll handle video in the text prompt
      }
    });
    
    // If video was attached, add a note about it
    if (hasVideo) {
      const videoNote = content.find(c => c.type === 'text');
      if (videoNote) {
        videoNote.text += '\n\n[Note: A video file was also attached. Video analysis is not fully supported yet, but you can describe what you see in the video if applicable.]"';
      }
    }

    // Build conversation history
    const messages = [
      {
        role: 'system',
        content: `You are Study Buddy, a helpful study assistant for Hong Kong secondary students (Form 1-3, ages 12-15).

Your personality:
- Friendly and encouraging
- Patient with explanations
- Use simple, clear language
- Give examples when helpful
- Keep responses concise (2-4 paragraphs max)

You can help with:
- Explaining school subjects (Math, Science, History, English, Chinese)
- Homework questions
- Study tips and techniques
- Test preparation
- Understanding concepts
- Analyzing images (worksheets, diagrams, problems)

When analyzing images:
- Describe what you see
- Explain the content clearly
- Answer questions about the image
- Help solve problems shown in the image

Always be supportive and never make the student feel bad for asking questions.`
      },
      ...context.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: content.length === 1 && content[0].type === 'text' 
          ? content[0].text 
          : content
      }
    ];

    const response = await kimiService.sendMessageToKimi(messages, {
      maxTokens: 1000,
      temperature: 0.7
    });

    // Save conversation to database
    const db = require('../db/connection');
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Insert user message
    await db.query(
      `INSERT INTO ai_conversations (student_id, session_id, conversation_type, message_role, message_content, media) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, sessionId, 'study_buddy', 'user', message || '[Media]', JSON.stringify(media || [])]
    );
    
    // Insert AI response
    await db.query(
      `INSERT INTO ai_conversations (student_id, session_id, conversation_type, message_role, message_content) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, sessionId, 'study_buddy', 'assistant', response]
    );

    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Study Buddy chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get response from Study Buddy',
      response: "I'm having trouble thinking right now. Can you try again in a moment? 🤔"
    });
  }
});

// ============================================
// CHAT HISTORY
// ============================================

router.get('/history', async (req, res) => {
  try {
    const db = require('../db/connection');
    const limit = parseInt(req.query.limit) || 50;
    const studentId = req.user.id;
    
    // Get recent messages grouped by session
    const result = await db.query(
      `SELECT 
        session_id,
        message_role,
        message_content,
        media,
        created_at
       FROM ai_conversations 
       WHERE student_id = $1 AND conversation_type = 'study_buddy'
       ORDER BY created_at DESC 
       LIMIT $2`,
      [studentId, limit]
    );
    
    // Group messages into conversations
    const sessions = {};
    result.rows.forEach(row => {
      if (!sessions[row.session_id]) {
        sessions[row.session_id] = {
          session_id: row.session_id,
          created_at: row.created_at,
          user_message: '',
          ai_response: '',
          media: row.media
        };
      }
      if (row.message_role === 'user') {
        sessions[row.session_id].user_message = row.message_content;
        sessions[row.session_id].media = row.media;
      } else if (row.message_role === 'assistant') {
        sessions[row.session_id].ai_response = row.message_content;
      }
    });
    
    const conversations = Object.values(sessions).filter(c => c.user_message || c.ai_response);
    
    res.json({
      success: true,
      conversations: conversations.reverse()
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load chat history'
    });
  }
});

module.exports = router;
