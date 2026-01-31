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

  quiz: `You are a quiz master. Create engaging quiz questions.

RULES:
- Ask one question at a time
- Start easier, increase difficulty
- Use multiple choice (A, B, C, D)
- Explain correct/incorrect after answer
- Celebrate correct answers! 🎉
- For wrong answers, explain briefly
- Mix types: multiple choice, true/false, fill-blank
- Respond in same language as topic`,

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

// Initial prompts for each mode
const INITIAL_PROMPTS = {
  learn: (topic, subject) => `Start a Socratic session about "${topic}" in ${subject}. Greet warmly and ask an opening question to gauge understanding. Be brief.`,
  quiz: (topic, subject) => `Start a quiz about "${topic}" in ${subject}. Greet, explain you'll test their knowledge, ask first multiple choice question.`,
  hint: (topic, subject) => `Start a hint session about "${topic}" in ${subject}. Greet and ask what problem they need help with.`,
  explain: (topic, subject) => `Start explaining "${topic}" in ${subject}. Greet and provide a clear introduction. Ask if they want to go deeper.`
};

// Create system prompt
const createSystemPrompt = (subject, topic, mode) => {
  return `${MODE_PROMPTS[mode] || MODE_PROMPTS.learn}

SESSION INFO:
- Subject: ${subject}
- Topic: ${topic}
- Mode: ${mode}

Stay focused on ${topic}. Be encouraging and adapt to the student's level.`;
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
    `SELECT role, content FROM tutor_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
};

// ============================================
// START SESSION
// ============================================
router.post('/session/start', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    const { subject, topic, mode } = req.body;
    const studentId = req.user.id;

    console.log('🎓 Starting tutor session:', { studentId, subject, topic, mode });

    if (!subject || !topic || !mode) {
      return res.status(400).json({ error: 'Subject, topic, and mode are required' });
    }

    if (!['learn', 'quiz', 'hint', 'explain'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Verify student exists
    const studentCheck = await client.query(
      `SELECT id, full_name, username FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentCheck.rows[0];
    console.log('👤 Student:', student.full_name || student.username);

    await client.query('BEGIN');

    const systemPrompt = createSystemPrompt(subject, topic, mode);
    const initialPrompt = INITIAL_PROMPTS[mode](topic, subject);
    
    console.log('🤖 Calling AI for initial response...');
    
    // Get AI response
    const aiResponse = await sendMessageToKimi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialPrompt }
    ]);

    console.log('✅ AI response received');

    // Create session
    const sessionResult = await client.query(
      `INSERT INTO tutor_sessions (student_id, subject, topic, mode) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [studentId, subject, topic, mode]
    );
    const sessionId = sessionResult.rows[0].id;

    console.log('📝 Session created:', sessionId);

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

    res.json({ sessionId, message: aiResponse, mode });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error starting tutor session:', error);
    res.status(500).json({ error: 'Failed to start session. Please try again.' });
  } finally {
    client.release();
  }
});

// ============================================
// SEND MESSAGE
// ============================================
router.post('/session/message', authenticateToken, async (req, res) => {
  const client = await getClient();
  
  try {
    const { sessionId, message } = req.body;
    const studentId = req.user.id;

    console.log('💬 Processing message for session:', sessionId);

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Verify session belongs to student
    const sessionResult = await client.query(
      `SELECT * FROM tutor_sessions WHERE id = $1 AND student_id = $2`,
      [sessionId, studentId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.end_time) {
      return res.status(400).json({ error: 'Session has ended' });
    }

    await client.query('BEGIN');

    // Get history and build messages
    const history = await getConversationHistory(sessionId);
    const kimiMessages = history.map(msg => ({ role: msg.role, content: msg.content }));
    kimiMessages.push({ role: 'user', content: message });

    console.log('🤖 Calling AI with', kimiMessages.length, 'messages...');

    // Get AI response
    const aiResponse = await sendMessageToKimi(kimiMessages);

    console.log('✅ AI response received');

    // Save messages
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sessionId, message]
    );
    await client.query(
      `INSERT INTO tutor_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
      [sessionId, aiResponse]
    );

    // Update stats
    let questionsAnswered = session.questions_answered || 0;
    let hintsGiven = session.hints_given || 0;
    const lowerResponse = aiResponse.toLowerCase();
    
    if (session.mode === 'quiz' && 
        (lowerResponse.includes('correct') || lowerResponse.includes('right') || 
         lowerResponse.includes('exactly') || lowerResponse.includes('well done') ||
         lowerResponse.includes('great job') || lowerResponse.includes('正确') || 
         lowerResponse.includes('答对'))) {
      questionsAnswered += 1;
    }

    if (session.mode === 'hint' && 
        (lowerResponse.includes('hint:') || lowerResponse.includes('try thinking') ||
         lowerResponse.includes('提示'))) {
      hintsGiven += 1;
    }

    await client.query(
      `UPDATE tutor_sessions 
       SET message_count = message_count + 1, 
           questions_answered = $1,
           hints_given = $2,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [questionsAnswered, hintsGiven, sessionId]
    );

    await client.query('COMMIT');

    res.json({
      message: aiResponse,
      stats: { 
        messageCount: (session.message_count || 0) + 1, 
        questionsAnswered 
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error processing message:', error);
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

    const sessionResult = await client.query(
      `SELECT * FROM tutor_sessions WHERE id = $1 AND student_id = $2`,
      [sessionId, studentId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.end_time) {
      return res.status(400).json({ error: 'Session already ended' });
    }

    await client.query('BEGIN');

    const duration = Math.max(1, Math.round((new Date() - new Date(session.start_time)) / 60000));
    const xpEarned = calculateXP(duration, session.message_count || 0, session.questions_answered || 0, session.mode);

    console.log('📊 Session stats:', { duration, xpEarned, messageCount: session.message_count });

    await client.query(
      `UPDATE tutor_sessions 
       SET end_time = CURRENT_TIMESTAMP, duration = $1, xp_earned = $2, updated_at = CURRENT_TIMESTAMP 
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

    res.json({
      success: true,
      stats: {
        duration,
        messagesExchanged: session.message_count || 0,
        questionsAnswered: session.questions_answered || 0,
        xpEarned
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
// GET SESSION HISTORY
// ============================================
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { limit = 10, subject } = req.query;

    let sql = `
      SELECT id, subject, topic, mode, duration, xp_earned, start_time, message_count, questions_answered 
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
    `;
    const params = [studentId];

    if (subject) {
      sql += ` AND subject = $2`;
      params.push(subject);
    }

    sql += ` ORDER BY start_time DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json({ sessions: result.rows });

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

    const result = await query(`
      SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(SUM(xp_earned), 0) as total_xp,
        COALESCE(SUM(message_count), 0) as total_messages,
        COALESCE(SUM(questions_answered), 0) as total_questions
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
    `, [studentId]);

    const overview = result.rows[0];

    const bySubjectResult = await query(`
      SELECT 
        subject,
        COUNT(*) as sessions,
        COALESCE(SUM(duration), 0) as duration,
        COALESCE(SUM(xp_earned), 0) as xp
      FROM tutor_sessions 
      WHERE student_id = $1 AND end_time IS NOT NULL
      GROUP BY subject
      ORDER BY sessions DESC
    `, [studentId]);

    res.json({
      overview: {
        totalSessions: parseInt(overview.total_sessions) || 0,
        totalDuration: parseInt(overview.total_duration) || 0,
        totalXP: parseInt(overview.total_xp) || 0,
        totalMessages: parseInt(overview.total_messages) || 0,
        totalQuestionsAnswered: parseInt(overview.total_questions) || 0
      },
      bySubject: bySubjectResult.rows
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;