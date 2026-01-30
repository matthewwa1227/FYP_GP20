const { query } = require('../db/connection');
const kimiService = require('../services/kimiService');

// Chat with Study Buddy
const chatWithBuddy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, conversationHistory = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get user context from students table
    const userStatsResult = await query(`
      SELECT 
        s.full_name,
        s.current_level,
        s.experience_points,
        s.current_streak,
        s.total_study_minutes,
        s.total_sessions,
        (SELECT COUNT(*) FROM tasks WHERE user_id = s.id AND status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE user_id = s.id AND status = 'pending') as pending_tasks,
        (SELECT COALESCE(SUM(duration), 0) FROM study_sessions WHERE student_id = s.id AND DATE(created_at) = CURRENT_DATE) as today_study_minutes
      FROM students s
      WHERE s.id = $1
    `, [userId]);

    const userContext = userStatsResult.rows[0] || {};

    // Map to expected format
    const contextForAI = {
      full_name: userContext.full_name,
      level: userContext.current_level,
      xp: userContext.experience_points,
      current_streak: userContext.current_streak,
      completed_tasks: userContext.completed_tasks || 0,
      pending_tasks: userContext.pending_tasks || 0,
      today_study_minutes: userContext.today_study_minutes || 0
    };

    // Get AI response
    const aiResponse = await kimiService.chatWithStudyBuddy(
      message,
      conversationHistory,
      contextForAI
    );

    // Save conversation
    await query(`
      INSERT INTO ai_conversations (user_id, user_message, ai_response, conversation_type)
      VALUES ($1, $2, $3, 'chat')
    `, [userId, message, aiResponse]);

    res.json({
      success: true,
      response: aiResponse,
      userContext: {
        name: userContext.full_name,
        level: userContext.current_level,
        todayStudyMinutes: userContext.today_study_minutes || 0
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get response'
    });
  }
};

// Generate optimized study schedule
const generateSchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences = {}, dateRange = 7 } = req.body;

    // Get pending tasks
    const tasksResult = await query(`
      SELECT id, title, description, priority, estimated_duration, due_date, subject
      FROM tasks 
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY due_date ASC NULLS LAST, priority DESC
    `, [userId]);

    // Get study patterns from study_sessions
    const studyPatternsResult = await query(`
      SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        EXTRACT(HOUR FROM created_at) as hour,
        AVG(duration) as avg_duration,
        AVG(focus_score) as avg_focus
      FROM study_sessions
      WHERE student_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
      ORDER BY avg_focus DESC NULLS LAST
    `, [userId]);

    // Get existing scheduled sessions
    const existingEventsResult = await query(`
      SELECT title, start_time, end_time
      FROM scheduled_sessions
      WHERE user_id = $1 AND start_time > NOW() AND start_time < NOW() + INTERVAL '1 day' * $2
      AND status = 'scheduled'
    `, [userId, dateRange]);

    // Generate schedule
    const schedule = await kimiService.generateStudySchedule({
      tasks: tasksResult.rows,
      studyPatterns: studyPatternsResult.rows,
      existingEvents: existingEventsResult.rows,
      preferences,
      dateRange
    });

    // Save generated sessions
    if (schedule.sessions && schedule.sessions.length > 0) {
      for (const session of schedule.sessions) {
        await query(`
          INSERT INTO scheduled_sessions (user_id, task_id, title, start_time, end_time, description, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
        `, [
          userId,
          session.taskId || null,
          session.title,
          new Date(session.startTime),
          new Date(session.endTime),
          session.description || ''
        ]);
      }
    }

    res.json({
      success: true,
      schedule,
      message: `Generated ${schedule.sessions?.length || 0} study sessions`
    });

  } catch (error) {
    console.error('Schedule generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate schedule'
    });
  }
};

// Get study tips
const getStudyTips = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, difficulty } = req.query;

    const performanceResult = await query(`
      SELECT 
        subject,
        AVG(focus_score) as avg_focus,
        SUM(duration) as total_minutes,
        COUNT(*) as session_count
      FROM study_sessions
      WHERE student_id = $1 AND created_at > NOW() - INTERVAL '14 days'
      GROUP BY subject
    `, [userId]);

    const tips = await kimiService.generateStudyTips({
      subject,
      difficulty,
      performance: performanceResult.rows
    });

    res.json({
      success: true,
      tips
    });

  } catch (error) {
    console.error('Tips error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate tips'
    });
  }
};

// Get conversation history
const getConversationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const conversationsResult = await query(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE user_id = $1 AND conversation_type = 'chat'
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, parseInt(limit)]);

    res.json({
      success: true,
      conversations: conversationsResult.rows.reverse()
    });

  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history'
    });
  }
};

// Get scheduled sessions
const getScheduledSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let queryText = `
      SELECT ss.*, t.title as task_title, t.subject
      FROM scheduled_sessions ss
      LEFT JOIN tasks t ON ss.task_id = t.id
      WHERE ss.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND ss.start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      queryText += ` AND ss.start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY ss.start_time ASC`;

    const sessionsResult = await query(queryText, params);

    res.json({
      success: true,
      sessions: sessionsResult.rows
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
};

module.exports = {
  chatWithBuddy,
  generateSchedule,
  getStudyTips,
  getConversationHistory,
  getScheduledSessions
};