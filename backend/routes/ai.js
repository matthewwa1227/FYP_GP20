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
        content: `You are Study Buddy, a comprehensive AI learning companion for Hong Kong students.

🎯 YOUR CAPABILITIES - Let students know you can help with:

📚 KNOWLEDGE & RESEARCH
- Answer questions across any topic: Science, History, Coding, Creative Writing, Analysis
- Explain complex concepts step-by-step with age-appropriate language
- Provide examples from Hong Kong context (MTR, local culture, DSE curriculum)
- Connect learning to real-world applications

💻 WORKING WITH DATA & FILES
- Analyze images: worksheets, diagrams, charts, problems, handwriting
- Read and interpret text from uploaded images
- Help with data analysis and statistics
- Assist with spreadsheet formulas and calculations

🖼️ IMAGE CAPABILITIES
- "See" and understand uploaded images
- Describe what's in photos or diagrams
- Read text from worksheets or notes
- Analyze charts and graphs
- Help solve problems shown in images using Socratic method

💻 CODE & TECHNICAL HELP
- Write and debug code in Python, JavaScript, HTML/CSS, and more
- Explain programming concepts step-by-step
- Help with computer science assignments
- Create simple scripts and programs

✍️ WRITING & CONTENT CREATION
- Draft essays, reports, and creative writing
- Help with email writing and formal correspondence
- Assist with Chinese and English composition
- Provide writing feedback and suggestions

🌐 TRANSLATION & LANGUAGE
- Translate between English and Chinese
- Explain grammar concepts
- Help with vocabulary building
- Practice conversation in different languages

🧠 STUDY SKILLS
- Provide study tips and techniques (Pomodoro, active recall, spaced repetition)
- Help create study plans and schedules
- Suggest memory techniques and mnemonics
- Test preparation strategies

PERSONALITY:
- Friendly, encouraging, and patient
- Use age-appropriate language for Hong Kong students
- Celebrate effort and progress
- Keep responses concise but comprehensive
- Use emojis to be engaging but not excessive

TEACHING APPROACH:
- Use Socratic method: guide rather than just give answers
- Break complex problems into smaller steps
- Ask guiding questions to help students discover answers
- Provide hints before giving solutions
- Only give direct answers after 3+ attempts or if explicitly asked

When analyzing images:
- Describe what you see clearly
- Reference specific details from the image
- If it's a homework problem, guide through it step-by-step
- Ask what the student has tried before giving hints

Always be supportive and create a safe space for learning!`
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
// CAPABILITIES - Get AI capabilities info
// ============================================
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = {
      success: true,
      categories: [
        {
          id: 'knowledge',
          title: '📚 Knowledge & Research',
          description: 'Ask me anything! Science, History, Coding, Creative Writing, Analysis, and more.',
          examples: [
            'Explain photosynthesis like I\'m 12',
            'What caused World War II?',
            'How do I write a good essay introduction?',
            'Help me understand Pythagorean theorem'
          ]
        },
        {
          id: 'images',
          title: '🖼️ Image Analysis',
          description: 'Upload images and I\'ll analyze them! Worksheets, diagrams, charts, problems, and more.',
          examples: [
            'Help me solve this math problem (upload image)',
            'What does this diagram show?',
            'Read the text in this photo',
            'Explain this chart to me'
          ]
        },
        {
          id: 'coding',
          title: '💻 Coding & Programming',
          description: 'Write and debug code in Python, JavaScript, HTML/CSS, and more.',
          examples: [
            'Write a Python function to calculate factorial',
            'Debug this JavaScript code',
            'Explain what this code does',
            'Help me create a simple calculator app'
          ]
        },
        {
          id: 'writing',
          title: '✍️ Writing & Content',
          description: 'Draft essays, reports, emails, creative writing, and get feedback.',
          examples: [
            'Help me write an email to my teacher',
            'Give me feedback on this essay paragraph',
            'Help me start a creative story',
            'How do I structure a book report?'
          ]
        },
        {
          id: 'language',
          title: '🌐 Translation & Language',
          description: 'Translate between English and Chinese, explain grammar, build vocabulary.',
          examples: [
            'Translate this to Chinese',
            'Explain the difference between affect and effect',
            'How do I say "thank you" formally in English?',
            'Help me practice English conversation'
          ]
        },
        {
          id: 'study',
          title: '🧠 Study Skills',
          description: 'Study techniques, memory tips, test prep strategies, and study plans.',
          examples: [
            'What\'s the best way to memorize vocabulary?',
            'Help me create a study schedule',
            'How do I prepare for a DSE exam?',
            'Give me tips for staying focused'
          ]
        },
        {
          id: 'data',
          title: '📊 Data & Analysis',
          description: 'Analyze data, create charts, help with statistics and calculations.',
          examples: [
            'Help me understand this data',
            'How do I calculate the average?',
            'Explain what correlation means',
            'Help me organize this information'
          ]
        },
        {
          id: 'homework',
          title: '📝 Homework Help',
          description: 'Get guidance on homework using the Socratic method - I\'ll guide you to the answer!',
          examples: [
            'I\'m stuck on this problem, can you give me a hint?',
            'How do I approach this question?',
            'What formula should I use here?',
            'Check my work on this problem'
          ]
        }
      ]
    };
    
    res.json(capabilities);
  } catch (error) {
    console.error('Capabilities error:', error);
    res.status(500).json({ success: false, error: 'Failed to load capabilities' });
  }
});

// ============================================
// QUICK ACTIONS - Pre-defined helpful responses
// ============================================
router.post('/quick-action', async (req, res) => {
  try {
    const { action, context = {} } = req.body;
    const kimiService = require('../services/kimiService');
    
    const userContext = {
      full_name: req.user?.username || 'Student',
      level: req.user?.level || 1,
      xp: req.user?.xp || 0,
      current_streak: req.user?.current_streak || 0,
      ageTier: req.user?.ageTier,
      formLevel: req.user?.formLevel
    };
    
    let prompt = '';
    let response = '';
    
    switch (action) {
      case 'explain_concept':
        prompt = `Explain the concept "${context.topic || 'learning'}" to a Hong Kong student in a simple, engaging way. Use analogies and examples they can relate to. Keep it under 150 words.`;
        break;
        
      case 'study_tips':
        prompt = `Give 3-5 quick study tips for a Hong Kong student studying ${context.subject || 'for exams'}. Make them practical and actionable.`;
        break;
        
      case 'motivation':
        prompt = `Give an encouraging, motivational message to a student who might be feeling stressed or unmotivated. Keep it warm and supportive, under 100 words. Reference their hero journey in learning.`;
        break;
        
      case 'practice_problem':
        prompt = `Generate a practice ${context.subject || 'math'} problem appropriate for a Hong Kong secondary student. Include the problem and the answer (hidden until they try).`;
        break;
        
      case 'memory_trick':
        prompt = `Share a memory technique or mnemonic for remembering ${context.topic || 'information'}. Make it creative and memorable.`;
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }
    
    const messages = [
      { role: 'system', content: 'You are a helpful study assistant. Be concise and encouraging.' },
      { role: 'user', content: prompt }
    ];
    
    response = await kimiService.sendMessageToKimi(messages, { maxTokens: 800 });
    
    res.json({
      success: true,
      action,
      response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Quick action error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process quick action',
      response: 'Let me help you with that! What would you like to know?' 
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
