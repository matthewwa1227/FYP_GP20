const { query } = require('../db/connection');
const kimiService = require('../services/kimiService');

// ============================================
// HELPER: Extract URLs from message
// ============================================
const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// ============================================
// HELPER: Check if message is homework/help request
// ============================================
const isHomeworkRequest = (message) => {
  const homeworkPatterns = [
    /solve.*for me/i,
    /what is the answer/i,
    /give me the answer/i,
    /help me do my homework/i,
    /do this.*for me/i,
    /what's the solution/i,
    /tell me the answer/i,
    /just give me/i,
    /what is.*\?$/i,
    /how do I solve/i,
    /calculate.*for me/i
  ];
  return homeworkPatterns.some(pattern => pattern.test(message));
};

// ============================================
// STUDY BUDDY CONTROLLERS
// ============================================

// Chat with Study Buddy - Enhanced with Socratic method
const chatWithBuddy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, conversationHistory = [], mediaContent = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get user context
    const userStatsResult = await query(`
      SELECT 
        s.full_name, s.current_level, s.experience_points, s.current_streak,
        s.total_study_minutes, s.total_sessions,
        (SELECT COUNT(*) FROM tasks WHERE user_id = s.id AND status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE user_id = s.id AND status = 'pending') as pending_tasks,
        (SELECT COALESCE(SUM(duration), 0) FROM study_sessions WHERE student_id = s.id AND DATE(created_at) = CURRENT_DATE) as today_study_minutes
      FROM students s WHERE s.id = $1
    `, [userId]);

    const userContext = userStatsResult.rows[0] || {};

    // Check for recent hint requests on same topic (for escalation)
    const recentHintsResult = await query(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE user_id = $1 
        AND conversation_type = 'chat'
        AND created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    // Count how many times user asked about similar topic recently
    const recentHints = recentHintsResult.rows;
    const similarTopicCount = recentHints.filter(h => 
      message.toLowerCase().includes(h.user_message.toLowerCase().substring(0, 10)) ||
      h.user_message.toLowerCase().includes(message.toLowerCase().substring(0, 10))
    ).length;

    // Extract URLs from message
    const urls = extractUrls(message);
    const hasUrls = urls.length > 0;
    const isHomework = isHomeworkRequest(message);

    // Get conversation history from database
    const dbHistoryResult = await query(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE user_id = $1 
        AND conversation_type = 'chat'
        AND user_message IS NOT NULL AND user_message != ''
        AND ai_response IS NOT NULL AND ai_response != ''
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    const formattedHistory = [];
    dbHistoryResult.rows.reverse().forEach(row => {
      formattedHistory.push({ role: 'user', content: row.user_message });
      formattedHistory.push({ role: 'assistant', content: row.ai_response });
    });

    // Build enhanced context for AI
    const contextForAI = {
      full_name: userContext.full_name,
      level: userContext.current_level,
      xp: userContext.experience_points,
      current_streak: userContext.current_streak,
      completed_tasks: userContext.completed_tasks || 0,
      pending_tasks: userContext.pending_tasks || 0,
      today_study_minutes: userContext.today_study_minutes || 0,
      recentHintCount: similarTopicCount,
      isHomeworkRequest: isHomework,
      hasUrls: hasUrls,
      urls: urls
    };

    // MISSION: Use direct-answer mode for simple questions, Socratic only for homework help
    const useSocratic = isHomework && similarTopicCount < 2;
    console.log(`🤖 Study Buddy mode: ${useSocratic ? 'SOCRATIC' : 'DIRECT'} (homework=${isHomework}, hints=${similarTopicCount})`);
    
    const aiResponse = useSocratic
      ? await kimiService.chatWithStudyBuddySocratic(
          message,
          formattedHistory,
          contextForAI,
          mediaContent
        )
      : await kimiService.chatWithStudyBuddy(
          message,
          formattedHistory,
          contextForAI
        );

    // Save conversation
    const isValidResponse = aiResponse && 
      aiResponse.trim() !== '' &&
      !aiResponse.includes('connection issue');

    if (isValidResponse) {
      await query(`
        INSERT INTO ai_conversations (user_id, user_message, ai_response, conversation_type)
        VALUES ($1, $2, $3, 'chat')
      `, [userId, message.trim(), aiResponse.trim()]);
    }

    res.json({
      success: true,
      response: aiResponse,
      meta: {
        hintLevel: similarTopicCount,
        isHomework: isHomework,
        urlsDetected: urls.length,
        isDirectAnswer: similarTopicCount >= 3
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

// ============================================
// REST OF CONTROLLERS (unchanged)
// ============================================

const generateSchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences = {}, dateRange = 7, tasks: frontendTasks } = req.body;

    let tasks = [];

    if (frontendTasks && frontendTasks.length > 0) {
      tasks = frontendTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority || 'medium',
        estimated_duration: t.estimatedMinutes || t.estimated_duration || 30,
        due_date: t.dueDate || t.due_date,
        subject: t.subject || 'General'
      }));
    } else {
      const tasksResult = await query(`
        SELECT id, title, description, priority, estimated_duration, due_date, subject
        FROM tasks 
        WHERE user_id = $1 AND status != 'completed'
        ORDER BY 
          CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
          due_date ASC,
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
            ELSE 2 
          END
      `, [userId]);
      tasks = tasksResult.rows;
    }

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

    const existingEventsResult = await query(`
      SELECT title, start_time, end_time
      FROM scheduled_sessions
      WHERE user_id = $1 AND start_time > NOW() AND start_time < NOW() + INTERVAL '1 day' * $2
      AND status = 'scheduled'
    `, [userId, dateRange]);

    const schedule = await kimiService.generateStudySchedule({
      tasks,
      studyPatterns: studyPatternsResult.rows,
      existingEvents: existingEventsResult.rows,
      preferences,
      dateRange
    });

    if (schedule.sessions && schedule.sessions.length > 0) {
      await query(`
        DELETE FROM scheduled_sessions 
        WHERE user_id = $1 AND status = 'scheduled' AND start_time > NOW()
      `, [userId]);

      for (const session of schedule.sessions) {
        if (session.type === 'break') continue;
        
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

    const studySessions = schedule.sessions?.filter(s => s.type !== 'break') || [];
    
    res.json({
      success: true,
      schedule,
      message: `Generated ${studySessions.length} study sessions for ${dateRange} days`
    });

  } catch (error) {
    console.error('Schedule generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate schedule'
    });
  }
};

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

const getConversationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const conversationsResult = await query(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE user_id = $1 
        AND conversation_type = 'chat'
        AND user_message IS NOT NULL AND user_message != ''
        AND ai_response IS NOT NULL AND ai_response != ''
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

// ============================================
// STORY QUEST CONTROLLERS
// ============================================

const generateStoryIntroduction = async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    console.log(`📖 Generating story intro for topic: ${topic}`);
    
    const storyIntro = await kimiService.generateStoryIntro(topic.trim());

    res.json({
      success: true,
      ...storyIntro
    });

  } catch (error) {
    console.error('Story intro error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate story introduction'
    });
  }
};

const generateScene = async (req, res) => {
  try {
    const { topic, chapter, sceneType, context } = req.body;
    
    if (!topic || !sceneType) {
      return res.status(400).json({
        success: false,
        message: 'Topic and sceneType are required'
      });
    }

    console.log(`🎬 Generating ${sceneType} scene for ${topic} (Chapter ${chapter})`);
    
    const scene = await kimiService.generateStoryScene(
      topic,
      chapter || 1,
      sceneType,
      context || {}
    );

    res.json({
      success: true,
      ...scene
    });

  } catch (error) {
    console.error('Scene generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate scene'
    });
  }
};

const generateLesson = async (req, res) => {
  try {
    const { topic, chapter, conceptNumber } = req.body;
    
    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    console.log(`📚 Generating lesson for ${topic} (Chapter ${chapter}, Concept ${conceptNumber})`);
    
    const lesson = await kimiService.generateStoryLesson(
      topic,
      chapter || 1,
      conceptNumber || 1
    );

    res.json({
      success: true,
      ...lesson
    });

  } catch (error) {
    console.error('Lesson generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate lesson',
      type: 'lesson',
      title: `${req.body.topic} Basics`,
      text: `Let's learn about ${req.body.topic}. This is an important concept that will help you understand more advanced topics.`,
      keyPoint: 'Understanding the basics is key to mastery.'
    });
  }
};

const generateQuestion = async (req, res) => {
  try {
    const { topic, difficulty, questionType, previousQuestions, conceptTitle } = req.body;
    
    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    console.log(`❓ Generating question for ${topic} (difficulty: ${difficulty})`);
    
    const question = await kimiService.generateStoryQuestion(
      topic,
      difficulty || 1,
      questionType || 'multiple_choice',
      previousQuestions || [],
      conceptTitle
    );

    res.json({
      success: true,
      ...question
    });

  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate question'
    });
  }
};

const saveStoryProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic, chapter, xp, hp, inventory, completed } = req.body;

    await query(`
      CREATE TABLE IF NOT EXISTS story_quest_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES students(id),
        topic VARCHAR(255),
        chapter INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 100,
        inventory JSONB DEFAULT '[]',
        completed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, topic)
      )
    `).catch(() => {});

    await query(`
      INSERT INTO story_quest_progress (user_id, topic, chapter, xp, hp, inventory, completed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id, topic) 
      DO UPDATE SET chapter = $3, xp = $4, hp = $5, inventory = $6, completed = $7, updated_at = NOW()
    `, [userId, topic, chapter, xp, hp, JSON.stringify(inventory || []), completed || false]);

    if (completed) {
      await query(`
        UPDATE students 
        SET experience_points = experience_points + $1
        WHERE id = $2
      `, [Math.floor(xp * 0.5), userId]);
    }

    res.json({
      success: true,
      message: 'Progress saved'
    });

  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save progress'
    });
  }
};

const getStoryProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.query;

    const result = await query(`
      SELECT * FROM story_quest_progress
      WHERE user_id = $1 AND topic = $2
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId, topic]).catch(() => ({ rows: [] }));

    if (result.rows.length > 0) {
      const progress = result.rows[0];
      if (progress.inventory && typeof progress.inventory === 'string') {
        progress.inventory = JSON.parse(progress.inventory);
      }
      res.json({
        success: true,
        progress
      });
    } else {
      res.json({
        success: true,
        progress: null
      });
    }

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress'
    });
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  chatWithBuddy,
  generateSchedule,
  getStudyTips,
  getConversationHistory,
  getScheduledSessions,
  generateStoryIntroduction,
  generateScene,
  generateLesson,
  generateQuestion,
  saveStoryProgress,
  getStoryProgress
};
