const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, getClient } = require('../db/connection');
const { sendMessageToKimi } = require('../services/kimiService');

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Tutor routes working',
    timestamp: new Date()
  });
});

// ============================================
// TEST AI ENDPOINT - Add this to debug
// ============================================
router.get('/test-ai', authenticateToken, async (req, res) => {
  console.log('');
  console.log('🧪 ========== TESTING AI SERVICE ==========');
  
  try {
    console.log('🧪 Calling sendMessageToKimi...');
    
    const testResponse = await sendMessageToKimi([
      { role: 'system', content: 'You are a helpful assistant. Be very brief.' },
      { role: 'user', content: 'Say exactly: "AI TEST SUCCESSFUL" and nothing else.' }
    ]);
    
    console.log('🧪 AI Test Response:', testResponse);
    console.log('🧪 ========== TEST COMPLETE ==========');
    console.log('');
    
    res.json({ 
      success: true, 
      aiResponse: testResponse,
      message: 'AI service is working!'
    });
  } catch (error) {
    console.error('🧪 AI Test FAILED:', error.message);
    console.error('🧪 Full error:', error);
    console.log('🧪 ========== TEST FAILED ==========');
    console.log('');
    
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// System prompts for different modes
const MODE_PROMPTS = {
  learn: `You are a Socratic tutor. Guide students to discover answers through thoughtful questions.

RULES:
- NEVER give direct answers
- Ask ONE leading question at a time
- Break problems into smaller steps if stuck
- Praise correct reasoning, gently redirect mistakes
- Use analogies and real examples
- Keep responses concise (2-4 sentences)
- End with a guiding question
- Respond in the same language the student uses`,

  quiz: `You are a quiz master creating a diverse quiz experience.

ABSOLUTE RULES - YOU MUST FOLLOW:
1. Ask ONE multiple choice question at a time
2. EVERY question must be COMPLETELY DIFFERENT from previous ones
3. Use format: A), B), C), D)
4. After student answers: say correct/incorrect, brief explanation, then ask a NEW different question
5. Cover DIFFERENT aspects: dates, people, causes, effects, definitions, comparisons
6. Celebrate correct answers! 🎉
7. Be encouraging for wrong answers
8. Respond in same language as topic
9. If asked about topic fundamentals, vary your questions widely`,

  hint: `You are a hint-giving tutor. Help without spoiling answers.

RULES:
- NEVER give direct answers
- Progressive hints (vague → specific)
- Use analogies
- Max 3 hints before offering to explain
- Keep hints brief and encouraging
- Respond in same language as student`,

  explain: `You are a patient teacher explaining concepts.

RULES:
- Start with simple definition
- Use analogies and real examples
- Break complex topics into parts
- Include practice example
- Ask if they need clarification
- Use emojis sparingly 📚
- Respond in same language as topic`
};

// Track questions per session in memory
const sessionQuestionCache = new Map();

// Get or create question tracker for session
const getQuestionTracker = (sessionId) => {
  if (!sessionQuestionCache.has(sessionId)) {
    sessionQuestionCache.set(sessionId, {
      questions: [],
      questionNumber: 0
    });
  }
  return sessionQuestionCache.get(sessionId);
};

// Extract question from AI response
const extractQuestionFromResponse = (response) => {
  if (!response) return null;
  
  // Look for text before A) B) C) D) options
  const match = response.match(/([^A-D\n]{15,}?\?)\s*\n*\s*A\)/s);
  if (match) return match[1].trim();
  
  // Fallback: find any question mark
  const questionMatch = response.match(/([^\n.!]{10,}\?)/);
  return questionMatch ? questionMatch[1].trim() : null;
};

// Create system prompt for quiz with question history
const createQuizSystemPrompt = (subject, topic, questionTracker) => {
  const { questions, questionNumber } = questionTracker;
  
  let prompt = `${MODE_PROMPTS.quiz}

SESSION INFO:
- Subject: ${subject}
- Topic: ${topic}
- Question Number: ${questionNumber + 1}`;

  if (questions.length > 0) {
    prompt += `

⚠️ QUESTIONS ALREADY ASKED - DO NOT ASK THESE AGAIN OR SIMILAR:
${questions.map((q, i) => `${i + 1}. "${q.substring(0, 80)}..."`).join('\n')}

Your next question MUST be about a DIFFERENT aspect of ${topic}.
Vary question types: who, what, when, where, why, how, which, true/false.`;
  }

  return prompt;
};

// Initial prompts for each mode
const INITIAL_PROMPTS = {
  learn: (topic, subject) => `Start a Socratic learning session about "${topic}" in ${subject}. Give a brief warm greeting and ask ONE opening question to gauge their current understanding.`,
  quiz: (topic, subject) => `Start a quiz about "${topic}" in ${subject}. Give a 1-sentence greeting, then ask your FIRST multiple choice question (A, B, C, D format). Make it a basic/easy question to start.`,
  hint: (topic, subject) => `Start a hint session for "${topic}" in ${subject}. Give a brief greeting and ask what specific problem or concept they need help with.`,
  explain: (topic, subject) => `Start explaining "${topic}" in ${subject}. Give a brief greeting, then provide a clear, beginner-friendly introduction to the concept.`
};

// Calculate XP earned
const calculateXP = (duration, messageCount, questionsAnswered, mode) => {
  let baseXP = Math.min(duration, 30) + Math.min(messageCount * 2, 40) + Math.min(questionsAnswered * 5, 50);
  const multipliers = { learn: 1.2, quiz: 1.1, hint: 1.0, explain: 0.9 };
  return Math.round(baseXP * (multipliers[mode] || 1));
};

// Get conversation history
const getConversationHistory = async (sessionId) => {
  const result = await query(
    `SELECT role, content FROM tutor_messages 
     WHERE session_id = $1 
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
};

// ============================================
// START SESSION
// ============================================
router.post('/session/start', authenticateToken, async (req, res) => {
  console.log('');
  console.log('🎓 ========== STARTING TUTOR SESSION ==========');
  
  const client = await getClient();
  
  try {
    const { subject, topic, mode } = req.body;
    const studentId = req.user.id;

    console.log('📝 Request:', { studentId, subject, topic, mode });

    if (!subject || !topic || !mode) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Subject, topic, and mode are required' });
    }

    if (!['learn', 'quiz', 'hint', 'explain'].includes(mode)) {
      console.log('❌ Invalid mode:', mode);
      return res.status(400).json({ error: 'Invalid mode. Use: learn, quiz, hint, or explain' });
    }

    // Verify student exists
    const studentCheck = await client.query(
      `SELECT id, full_name, username FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      console.log('❌ Student not found:', studentId);
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentCheck.rows[0];
    console.log('👤 Student:', student.full_name || student.username);

    await client.query('BEGIN');

    // Create session first to get ID
    const sessionResult = await client.query(
      `INSERT INTO tutor_sessions (student_id, subject, topic, mode) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [studentId, subject, topic, mode]
    );
    const sessionId = sessionResult.rows[0].id;
    console.log('📝 Session created with ID:', sessionId);

    // Initialize question tracker
    const questionTracker = getQuestionTracker(sessionId);

    // Create system prompt
    let systemPrompt;
    if (mode === 'quiz') {
      systemPrompt = createQuizSystemPrompt(subject, topic, questionTracker);
    } else {
      systemPrompt = `${MODE_PROMPTS[mode]}

SESSION INFO:
- Subject: ${subject}
- Topic: ${topic}
- Mode: ${mode}

Stay focused on ${topic}. Be encouraging and adapt to the student's level.`;
    }

    const initialPrompt = INITIAL_PROMPTS[mode](topic, subject);
    
    console.log('');
    console.log('🤖 ===== CALLING AI FOR INITIAL RESPONSE =====');
    console.log('📨 System prompt length:', systemPrompt.length);
    console.log('📨 Initial prompt:', initialPrompt.substring(0, 100) + '...');
    
    // Get AI response
    const aiResponse = await sendMessageToKimi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialPrompt }
    ]);

    console.log('✅ AI Response received!');
    console.log('📩 Response preview:', aiResponse.substring(0, 150) + '...');
    console.log('🤖 ===== AI CALL COMPLETE =====');
    console.log('');

    // Track first question if quiz mode
    if (mode === 'quiz') {
      const firstQuestion = extractQuestionFromResponse(aiResponse);
      if (firstQuestion) {
        questionTracker.questions.push(firstQuestion);
        questionTracker.questionNumber = 1;
        console.log('📋 First question tracked:', firstQuestion.substring(0, 60) + '...');
      }
    }

    // Save messages
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'system', $2)`,
      [sessionId, systemPrompt]
    );
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
      [sessionId, aiResponse]
    );

    await client.query('COMMIT');
    
    console.log('✅ Session started successfully!');
    console.log('🎓 ========== SESSION START COMPLETE ==========');
    console.log('');

    res.json({ 
      sessionId, 
      message: aiResponse, 
      mode,
      topic,
      subject
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ ========== ERROR STARTING SESSION ==========');
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ============================================');
    console.error('');
    res.status(500).json({ error: 'Failed to start session. Please try again.' });
  } finally {
    client.release();
  }
});

// ============================================
// SEND MESSAGE
// ============================================
router.post('/session/message', authenticateToken, async (req, res) => {
  console.log('');
  console.log('💬 ========== PROCESSING MESSAGE ==========');
  
  const client = await getClient();
  
  try {
    const { sessionId, message } = req.body;
    const studentId = req.user.id;

    console.log('📝 Session ID:', sessionId);
    console.log('📝 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Verify session belongs to student
    const sessionResult = await client.query(
      `SELECT * FROM tutor_sessions WHERE id = $1 AND student_id = $2`,
      [sessionId, studentId]
    );

    if (sessionResult.rows.length === 0) {
      console.log('❌ Session not found');
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    console.log('📋 Session:', { topic: session.topic, mode: session.mode, messageCount: session.message_count });

    if (session.end_time) {
      return res.status(400).json({ error: 'Session has ended. Please start a new session.' });
    }

    await client.query('BEGIN');

    // Get question tracker
    const questionTracker = getQuestionTracker(sessionId);
    
    // Rebuild cache from DB if empty
    if (questionTracker.questions.length === 0 && session.message_count > 0 && session.mode === 'quiz') {
      console.log('🔄 Rebuilding question cache from database...');
      const history = await getConversationHistory(sessionId);
      for (const msg of history) {
        if (msg.role === 'assistant') {
          const q = extractQuestionFromResponse(msg.content);
          if (q && !questionTracker.questions.includes(q)) {
            questionTracker.questions.push(q);
            questionTracker.questionNumber++;
          }
        }
      }
      console.log('📋 Rebuilt cache:', questionTracker.questions.length, 'questions');
    }

    // Get conversation history
    const history = await getConversationHistory(sessionId);
    console.log('📜 History messages:', history.length);

    // Build messages for AI
    const kimiMessages = [];
    
    // For quiz mode, create fresh system prompt with question history
    if (session.mode === 'quiz') {
      const systemPrompt = createQuizSystemPrompt(session.subject, session.topic, questionTracker);
      kimiMessages.push({ role: 'system', content: systemPrompt });
      console.log('📋 Questions tracked:', questionTracker.questions.length);
    } else {
      // Use original system message
      const systemMsg = history.find(m => m.role === 'system');
      if (systemMsg) {
        kimiMessages.push({ role: 'system', content: systemMsg.content });
      }
    }
    
    // Add conversation history (skip system message)
    for (const msg of history) {
      if (msg.role !== 'system') {
        kimiMessages.push({ role: msg.role, content: msg.content });
      }
    }
    
    // Add new user message
    kimiMessages.push({ role: 'user', content: message });

    console.log('');
    console.log('🤖 ===== CALLING AI =====');
    console.log('📨 Total messages:', kimiMessages.length);

    // Get AI response
    const aiResponse = await sendMessageToKimi(kimiMessages);

    console.log('✅ AI Response received!');
    console.log('📩 Response preview:', aiResponse.substring(0, 150) + '...');
    console.log('🤖 ===== AI CALL COMPLETE =====');
    console.log('');

    // Track new question if quiz mode
    if (session.mode === 'quiz') {
      const newQuestion = extractQuestionFromResponse(aiResponse);
      if (newQuestion && !questionTracker.questions.some(q => q.includes(newQuestion.substring(0, 30)))) {
        questionTracker.questions.push(newQuestion);
        questionTracker.questionNumber++;
        console.log('📋 New question tracked (#' + questionTracker.questionNumber + '):', newQuestion.substring(0, 60) + '...');
      }
    }

    // Save messages to database
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sessionId, message]
    );
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
      [sessionId, aiResponse]
    );

    // Update session stats
    let questionsAnswered = session.questions_answered || 0;
    let hintsGiven = session.hints_given || 0;
    
    const lowerResponse = aiResponse.toLowerCase();
    
    // Check if student answered correctly
    if (session.mode === 'quiz') {
      const correctIndicators = ['correct', 'right', 'exactly', 'well done', 'great job', 'excellent', 'yes!', '正确', '答对'];
      if (correctIndicators.some(ind => lowerResponse.includes(ind))) {
        questionsAnswered++;
        console.log('✅ Correct answer! Total correct:', questionsAnswered);
      }
    }

    if (session.mode === 'hint') {
      if (lowerResponse.includes('hint') || lowerResponse.includes('try')) {
        hintsGiven++;
      }
    }

    await client.query(
      `UPDATE tutor_sessions 
       SET message_count = COALESCE(message_count, 0) + 1, 
           questions_answered = $1,
           hints_given = $2,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [questionsAnswered, hintsGiven, sessionId]
    );

    await client.query('COMMIT');
    
    console.log('✅ Message processed successfully');
    console.log('💬 ========== MESSAGE COMPLETE ==========');
    console.log('');

    res.json({
      message: aiResponse,
      stats: { 
        messageCount: (session.message_count || 0) + 1, 
        questionsAnswered,
        totalQuestionsAsked: questionTracker.questionNumber
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ ========== ERROR PROCESSING MESSAGE ==========');
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ================================================');
    console.error('');
    res.status(500).json({ error: 'Failed to process message. Please try again.' });
  } finally {
    client.release();
  }
});

// ============================================
// END SESSION
// ============================================
router.post('/session/end', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    const { sessionId } = req.body;
    const studentId = req.user.id;

    console.log('🏁 Ending session:', sessionId);

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionResult = await client.query(
      `SELECT * FROM tutor_sessions WHERE id = $1 AND student_id = $2`,
      [sessionId, studentId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.end_time) {
      sessionQuestionCache.delete(sessionId);
      return res.json({
        success: true,
        message: 'Session was already ended',
        stats: {
          duration: session.duration,
          messagesExchanged: session.message_count || 0,
          questionsAnswered: session.questions_answered || 0,
          xpEarned: session.xp_earned || 0
        }
      });
    }

    await client.query('BEGIN');

    const startTime = new Date(session.start_time);
    const endTime = new Date();
    const duration = Math.max(1, Math.round((endTime - startTime) / 60000));
    
    const xpEarned = calculateXP(
      duration, 
      session.message_count || 0, 
      session.questions_answered || 0, 
      session.mode
    );

    console.log('📊 Final stats:', { duration, messages: session.message_count, correct: session.questions_answered, xpEarned });

    await client.query(
      `UPDATE tutor_sessions 
       SET end_time = CURRENT_TIMESTAMP, 
           duration = $1, 
           xp_earned = $2, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [duration, xpEarned, sessionId]
    );

    await client.query(
      `UPDATE students 
       SET xp = COALESCE(xp, 0) + $1,
           experience_points = COALESCE(experience_points, 0) + $1,
           total_points = COALESCE(total_points, 0) + $1,
           tutor_sessions_count = COALESCE(tutor_sessions_count, 0) + 1,
           total_tutor_time = COALESCE(total_tutor_time, 0) + $2,
           total_study_minutes = COALESCE(total_study_minutes, 0) + $2
       WHERE id = $3`,
      [xpEarned, duration, studentId]
    );

    await client.query('COMMIT');

    // Clean up cache
    sessionQuestionCache.delete(sessionId);

    console.log('✅ Session ended successfully');

    res.json({
      success: true,
      stats: {
        duration,
        messagesExchanged: session.message_count || 0,
        questionsAnswered: session.questions_answered || 0,
        hintsGiven: session.hints_given || 0,
        xpEarned,
        mode: session.mode,
        topic: session.topic
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  } finally {
    client.release();
  }
});

// ============================================
// GET ACTIVE SESSION
// ============================================
router.get('/session/active', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await query(
      `SELECT id, subject, topic, mode, start_time, message_count, questions_answered
       FROM tutor_sessions 
       WHERE student_id = $1 AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.json({ activeSession: null });
    }

    const session = result.rows[0];
    
    const messagesResult = await query(
      `SELECT role, content, created_at 
       FROM tutor_messages 
       WHERE session_id = $1 AND role != 'system'
       ORDER BY created_at DESC
       LIMIT 10`,
      [session.id]
    );

    res.json({
      activeSession: {
        ...session,
        recentMessages: messagesResult.rows.reverse()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching active session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// ============================================
// GET SESSION HISTORY
// ============================================
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { limit = 10, subject, mode } = req.query;

    let sql = `
      SELECT id, subject, topic, mode, duration, xp_earned, start_time, 
             message_count, questions_answered, hints_given
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
    `;
    const params = [studentId];
    let paramIndex = 2;

    if (subject) {
      sql += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }

    if (mode) {
      sql += ` AND mode = $${paramIndex}`;
      params.push(mode);
      paramIndex++;
    }

    sql += ` ORDER BY start_time DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    
    res.json({ 
      sessions: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ============================================
// GET TUTOR STATS
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    const overviewResult = await query(`
      SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(SUM(xp_earned), 0) as total_xp,
        COALESCE(SUM(message_count), 0) as total_messages,
        COALESCE(SUM(questions_answered), 0) as total_questions,
        COALESCE(SUM(hints_given), 0) as total_hints
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
    `, [studentId]);

    const overview = overviewResult.rows[0];

    const bySubjectResult = await query(`
      SELECT 
        subject,
        COUNT(*) as sessions,
        COALESCE(SUM(duration), 0) as duration,
        COALESCE(SUM(xp_earned), 0) as xp,
        COALESCE(SUM(questions_answered), 0) as questions_answered
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
      GROUP BY subject
      ORDER BY sessions DESC
    `, [studentId]);

    const byModeResult = await query(`
      SELECT 
        mode,
        COUNT(*) as sessions,
        COALESCE(SUM(duration), 0) as duration,
        COALESCE(SUM(xp_earned), 0) as xp
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
      GROUP BY mode
      ORDER BY sessions DESC
    `, [studentId]);

    res.json({
      overview: {
        totalSessions: parseInt(overview.total_sessions) || 0,
        totalDuration: parseInt(overview.total_duration) || 0,
        totalXP: parseInt(overview.total_xp) || 0,
        totalMessages: parseInt(overview.total_messages) || 0,
        totalQuestionsAnswered: parseInt(overview.total_questions) || 0,
        totalHintsGiven: parseInt(overview.total_hints) || 0
      },
      bySubject: bySubjectResult.rows,
      byMode: byModeResult.rows
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

console.log('📚 Tutor routes loaded (with question tracking v2)');

module.exports = router;