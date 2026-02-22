const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/teacher/classes - Get teacher's classes
// ============================================
router.get('/classes', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT 
        c.*,
        COUNT(cs.student_id) FILTER (WHERE cs.status = 'active') as student_count
      FROM classes c
      LEFT JOIN class_students cs ON c.id = cs.class_id
      WHERE c.teacher_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [teacherId]);

    res.json({ success: true, classes: result.rows });

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to load classes' });
  }
});

// ============================================
// POST /api/teacher/classes - Create a new class
// ============================================
router.post('/classes', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const { name, description, subject, gradeLevel, maxStudents, startDate, endDate } = req.body;

    // Generate a unique class code
    const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = await query(`
      INSERT INTO classes (
        teacher_id, name, description, subject, grade_level,
        class_code, max_students, start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [teacherId, name, description, subject, gradeLevel, classCode, maxStudents || 30, startDate, endDate]);

    res.json({ success: true, class: result.rows[0] });

  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, message: 'Failed to create class' });
  }
});

// ============================================
// POST /api/teacher/classes/:id/join - Student join class
// ============================================
router.post('/classes/:id/join', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { classCode } = req.body;

    // Find class by code
    const classResult = await query(`
      SELECT * FROM classes WHERE class_code = $1 AND is_active = TRUE
    `, [classCode]);

    if (classResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid class code' });
    }

    const classData = classResult.rows[0];

    // Check if already enrolled
    const existingResult = await query(`
      SELECT * FROM class_students WHERE class_id = $1 AND student_id = $2
    `, [classData.id, studentId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Already enrolled in this class' });
    }

    // Check class capacity
    const countResult = await query(`
      SELECT COUNT(*) as count FROM class_students 
      WHERE class_id = $1 AND status = 'active'
    `, [classData.id]);

    if (parseInt(countResult.rows[0].count) >= classData.max_students) {
      return res.status(400).json({ success: false, message: 'Class is full' });
    }

    // Enroll student
    await query(`
      INSERT INTO class_students (class_id, student_id, status)
      VALUES ($1, $2, 'active')
    `, [classData.id, studentId]);

    res.json({ success: true, message: 'Successfully joined class', class: classData });

  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ success: false, message: 'Failed to join class' });
  }
});

// ============================================
// GET /api/teacher/classes/:id/students - Get class students with analytics
// ============================================
router.get('/classes/:id/students', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const classId = req.params.id;

    // Verify teacher owns this class
    const classCheck = await query(`
      SELECT * FROM classes WHERE id = $1 AND teacher_id = $2
    `, [classId, teacherId]);

    if (classCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await query(`
      SELECT 
        s.id, s.username, s.full_name, s.avatar_url, s.level, s.xp,
        cs.joined_at, cs.status, cs.overall_grade, cs.attendance_rate,
        COALESCE(pt.total_minutes, 0) as study_minutes_this_week,
        COALESCE(pt.total_sessions, 0) as sessions_this_week,
        COALESCE(pt.accuracy_rate, 0) as accuracy_rate,
        sa.needs_attention,
        sa.attention_reasons
      FROM class_students cs
      JOIN students s ON cs.student_id = s.id
      LEFT JOIN progress_tracking pt ON pt.student_id = s.id 
        AND pt.tracking_date >= CURRENT_DATE - INTERVAL '7 days'
      LEFT JOIN student_analytics sa ON sa.student_id = s.id 
        AND sa.teacher_id = $1 AND sa.analytics_date = CURRENT_DATE
      WHERE cs.class_id = $2 AND cs.status = 'active'
      ORDER BY s.username
    `, [teacherId, classId]);

    res.json({ success: true, students: result.rows });

  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ success: false, message: 'Failed to load students' });
  }
});

// ============================================
// GET /api/teacher/classes/:id/analytics - Get class analytics
// ============================================
router.get('/classes/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const classId = req.params.id;

    // Verify teacher owns this class
    const classCheck = await query(`
      SELECT * FROM classes WHERE id = $1 AND teacher_id = $2
    `, [classId, teacherId]);

    if (classCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get class analytics
    const analyticsResult = await query(`
      SELECT * FROM class_analytics
      WHERE class_id = $1
      ORDER BY analytics_date DESC
      LIMIT 7
    `, [classId]);

    // Get subject breakdown
    const subjectResult = await query(`
      SELECT 
        ss.subject,
        SUM(ss.duration) as total_minutes,
        COUNT(*) as session_count,
        AVG(CASE WHEN ss.questions_answered > 0 
          THEN (ss.correct_answers::DECIMAL / ss.questions_answered) * 100 
          ELSE NULL END) as avg_accuracy
      FROM study_sessions ss
      JOIN class_students cs ON ss.student_id = cs.student_id
      WHERE cs.class_id = $1 
        AND ss.started_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY ss.subject
      ORDER BY total_minutes DESC
    `, [classId]);

    // Get top performers and needs attention
    const studentsResult = await query(`
      SELECT 
        s.id, s.username, s.full_name,
        SUM(ss.duration) as total_minutes,
        COUNT(ss.id) as session_count,
        AVG(CASE WHEN ss.questions_answered > 0 
          THEN (ss.correct_answers::DECIMAL / ss.questions_answered) * 100 
          ELSE NULL END) as avg_accuracy
      FROM students s
      JOIN class_students cs ON s.id = cs.student_id
      LEFT JOIN study_sessions ss ON s.id = ss.student_id 
        AND ss.started_at >= CURRENT_DATE - INTERVAL '30 days'
      WHERE cs.class_id = $1 AND cs.status = 'active'
      GROUP BY s.id, s.username, s.full_name
      ORDER BY total_minutes DESC NULLS LAST
    `, [classId]);

    const topPerformers = studentsResult.rows.slice(0, 5);
    const needsAttention = studentsResult.rows.filter(s => 
      s.total_minutes < 120 || s.avg_accuracy < 60
    ).slice(0, 5);

    res.json({
      success: true,
      analytics: {
        daily: analyticsResult.rows,
        subjects: subjectResult.rows,
        topPerformers,
        needsAttention,
        totalStudents: studentsResult.rowCount
      }
    });

  } catch (error) {
    console.error('Class analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
});

// ============================================
// POST /api/teacher/classes/:id/challenges - Create class challenge
// ============================================
router.post('/classes/:id/challenges', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const classId = req.params.id;
    const {
      title, description, challengeType, targetMetric, targetValue,
      timeLimitHours, xpReward, startDate, endDate
    } = req.body;

    // Verify teacher owns this class
    const classCheck = await query(`
      SELECT * FROM classes WHERE id = $1 AND teacher_id = $2
    `, [classId, teacherId]);

    if (classCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await query(`
      INSERT INTO class_challenges (
        class_id, created_by, title, description, challenge_type,
        target_metric, target_value, time_limit_hours, xp_reward,
        start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [classId, teacherId, title, description, challengeType, targetMetric,
        targetValue, timeLimitHours, xpReward, startDate, endDate]);

    // Auto-enroll all class students
    await query(`
      INSERT INTO challenge_participants (challenge_id, student_id)
      SELECT $1, student_id FROM class_students 
      WHERE class_id = $2 AND status = 'active'
      ON CONFLICT DO NOTHING
    `, [result.rows[0].id, classId]);

    res.json({ success: true, challenge: result.rows[0] });

  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ success: false, message: 'Failed to create challenge' });
  }
});

// ============================================
// GET /api/teacher/classes/:id/challenges - Get class challenges
// ============================================
router.get('/classes/:id/challenges', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const classId = req.params.id;

    const result = await query(`
      SELECT 
        cc.*,
        COUNT(cp.id) as participant_count,
        COUNT(cp.id) FILTER (WHERE cp.completed = TRUE) as completed_count
      FROM class_challenges cc
      LEFT JOIN challenge_participants cp ON cc.id = cp.challenge_id
      WHERE cc.class_id = $1
      GROUP BY cc.id
      ORDER BY cc.created_at DESC
    `, [classId]);

    res.json({ success: true, challenges: result.rows });

  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ success: false, message: 'Failed to load challenges' });
  }
});

// ============================================
// GET /api/teacher/students/:id/analytics - Get detailed student analytics
// ============================================
router.get('/students/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const studentId = req.params.id;

    // Verify teacher has this student in a class
    const checkResult = await query(`
      SELECT * FROM class_students cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.student_id = $1 AND c.teacher_id = $2
    `, [studentId, teacherId]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get detailed analytics
    const result = await query(`
      SELECT 
        sa.*,
        s.username, s.full_name, s.level, s.xp, s.current_streak
      FROM student_analytics sa
      JOIN students s ON sa.student_id = s.id
      WHERE sa.student_id = $1 AND sa.teacher_id = $2
      ORDER BY sa.analytics_date DESC
      LIMIT 30
    `, [studentId, teacherId]);

    // Get AI conversation summary
    const aiResult = await query(`
      SELECT 
        conversation_type,
        COUNT(*) as conversation_count,
        COUNT(*) FILTER (WHERE is_flagged = TRUE) as flagged_count
      FROM ai_conversations
      WHERE student_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY conversation_type
    `, [studentId]);

    res.json({
      success: true,
      analytics: result.rows,
      aiSummary: aiResult.rows
    });

  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
});

// ============================================
// GET /api/teacher/verify-sessions - Get sessions pending verification
// ============================================
router.get('/verify-sessions', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const { status = 'pending' } = req.query;

    const result = await query(`
      SELECT 
        sv.*,
        ss.subject, ss.topic, ss.duration, ss.started_at, ss.ended_at,
        ss.notes as session_notes,
        s.username, s.full_name,
        c.name as class_name
      FROM session_verifications sv
      JOIN study_sessions ss ON sv.session_id = ss.id
      JOIN students s ON sv.student_id = s.id
      JOIN class_students cs ON s.id = cs.student_id
      JOIN classes c ON cs.class_id = c.id
      WHERE c.teacher_id = $1 AND sv.status = $2
      ORDER BY ss.started_at DESC
    `, [teacherId, status]);

    res.json({ success: true, sessions: result.rows });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load sessions' });
  }
});

// ============================================
// PUT /api/teacher/verify-sessions/:id - Verify/reject session
// ============================================
router.put('/verify-sessions/:id', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.student?.id || req.user?.id;
    const sessionId = req.params.id;
    const { action, notes } = req.body; // action: 'verify' or 'reject'

    // Verify teacher has permission
    const checkResult = await query(`
      SELECT sv.* FROM session_verifications sv
      JOIN study_sessions ss ON sv.session_id = ss.id
      JOIN class_students cs ON ss.student_id = cs.student_id
      JOIN classes c ON cs.class_id = c.id
      WHERE sv.id = $1 AND c.teacher_id = $2
    `, [sessionId, teacherId]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (action === 'verify') {
      const result = await query(`
        UPDATE session_verifications
        SET status = 'verified',
            verified_by = $1,
            verified_at = CURRENT_TIMESTAMP,
            verification_method = 'manual',
            notes = $2
        WHERE id = $3
        RETURNING *
      `, [teacherId, notes, sessionId]);

      res.json({ success: true, session: result.rows[0] });
    } else {
      const result = await query(`
        UPDATE session_verifications
        SET status = 'rejected',
            rejection_reason = $1,
            rejected_by = $2,
            rejected_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [notes, teacherId, sessionId]);

      res.json({ success: true, session: result.rows[0] });
    }

  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify session' });
  }
});

module.exports = router;
