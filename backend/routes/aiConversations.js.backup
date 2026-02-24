const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// POST /api/ai-conversations - Save AI conversation
// ============================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const {
      sessionId, conversationType, messageRole, messageContent,
      messageMetadata, studentContext
    } = req.body;

    const result = await query(`
      INSERT INTO ai_conversations (
        student_id, session_id, conversation_type, message_role,
        message_content, message_metadata, student_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [studentId, sessionId, conversationType, messageRole, 
        messageContent, JSON.stringify(messageMetadata), JSON.stringify(studentContext)]);

    res.json({ success: true, message: result.rows[0] });

  } catch (error) {
    console.error('Save conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to save conversation' });
  }
});

// ============================================
// GET /api/ai-conversations - Get conversations (for student or reviewer)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const { studentId, sessionId, type, flagged } = req.query;
    const targetStudentId = studentId || userId;

    // Check permission
    const hasPermission = await checkReviewPermission(userId, targetStudentId);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to view conversations' });
    }

    let sql = `
      SELECT 
        ac.*,
        s.username as student_name,
        reviewer.username as reviewed_by_name
      FROM ai_conversations ac
      JOIN students s ON ac.student_id = s.id
      LEFT JOIN students reviewer ON ac.reviewed_by = reviewer.id
      WHERE ac.student_id = $1
    `;
    const params = [targetStudentId];
    let paramIndex = 2;

    if (sessionId) {
      sql += ` AND ac.session_id = $${paramIndex++}`;
      params.push(sessionId);
    }

    if (type) {
      sql += ` AND ac.conversation_type = $${paramIndex++}`;
      params.push(type);
    }

    if (flagged === 'true') {
      sql += ` AND ac.is_flagged = TRUE`;
    }

    sql += ` ORDER BY ac.created_at DESC LIMIT 100`;

    const result = await query(sql, params);

    // Group by session for easier viewing
    const sessions = {};
    result.rows.forEach(msg => {
      if (!sessions[msg.session_id]) {
        sessions[msg.session_id] = {
          sessionId: msg.session_id,
          type: msg.conversation_type,
          createdAt: msg.created_at,
          messages: []
        };
      }
      sessions[msg.session_id].messages.push({
        id: msg.id,
        role: msg.message_role,
        content: msg.message_content,
        metadata: msg.message_metadata,
        isFlagged: msg.is_flagged,
        flagReason: msg.flag_reason,
        reviewedBy: msg.reviewed_by_name,
        reviewedAt: ac.reviewed_at,
        createdAt: msg.created_at
      });
    });

    res.json({
      success: true,
      conversations: Object.values(sessions),
      totalMessages: result.rowCount
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
});

// ============================================
// PUT /api/ai-conversations/:id/flag - Flag a conversation
// ============================================
router.put('/:id/flag', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const messageId = req.params.id;
    const { reason } = req.body;

    // Get conversation to check permission
    const convResult = await query(`
      SELECT * FROM ai_conversations WHERE id = $1
    `, [messageId]);

    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];

    // Check permission
    const hasPermission = await checkReviewPermission(userId, conversation.student_id);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to flag conversations' });
    }

    const result = await query(`
      UPDATE ai_conversations
      SET is_flagged = TRUE,
          flag_reason = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [reason, userId, messageId]);

    res.json({ success: true, conversation: result.rows[0] });

  } catch (error) {
    console.error('Flag conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to flag conversation' });
  }
});

// ============================================
// PUT /api/ai-conversations/:id/review - Add review notes
// ============================================
router.put('/:id/review', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const messageId = req.params.id;
    const { notes, unflag } = req.body;

    // Get conversation to check permission
    const convResult = await query(`
      SELECT * FROM ai_conversations WHERE id = $1
    `, [messageId]);

    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];

    // Check permission
    const hasPermission = await checkReviewPermission(userId, conversation.student_id);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to review conversations' });
    }

    const result = await query(`
      UPDATE ai_conversations
      SET review_notes = $1,
          is_flagged = CASE WHEN $2 THEN FALSE ELSE is_flagged END,
          reviewed_by = $3,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [notes, unflag || false, userId, messageId]);

    res.json({ success: true, conversation: result.rows[0] });

  } catch (error) {
    console.error('Review conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to review conversation' });
  }
});

// ============================================
// GET /api/ai-conversations/stats - Get conversation statistics
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const { studentId } = req.query;
    const targetStudentId = studentId || userId;

    // Check permission
    const hasPermission = await checkReviewPermission(userId, targetStudentId);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission' });
    }

    // Get stats
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) FILTER (WHERE is_flagged = TRUE) as flagged_count,
        conversation_type,
        COUNT(*) as type_count
      FROM ai_conversations
      WHERE student_id = $1
      GROUP BY conversation_type
    `, [targetStudentId]);

    // Get recent activity
    const activityResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as message_count
      FROM ai_conversations
      WHERE student_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [targetStudentId]);

    res.json({
      success: true,
      stats: {
        breakdown: statsResult.rows,
        recentActivity: activityResult.rows,
        totalMessages: statsResult.rows.reduce((sum, row) => sum + parseInt(row.total_conversations), 0),
        flaggedMessages: statsResult.rows.reduce((sum, row) => sum + parseInt(row.flagged_count), 0)
      }
    });

  } catch (error) {
    console.error('Conversation stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// ============================================
// POST /api/ai-conversations/reviewers - Add a reviewer
// ============================================
router.post('/reviewers', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const { studentId, reviewerId, permissions } = req.body;

    // Only the student or existing parent can add reviewers
    const canAdd = userId === studentId || await checkReviewPermission(userId, studentId);
    if (!canAdd) {
      return res.status(403).json({ success: false, message: 'Not authorized to add reviewers' });
    }

    const result = await query(`
      INSERT INTO conversation_reviewers (
        student_id, reviewer_id, reviewer_role,
        can_view_all, can_flag_conversations, can_add_notes, receive_alerts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (student_id, reviewer_id)
      DO UPDATE SET
        can_view_all = $4,
        can_flag_conversations = $5,
        can_add_notes = $6,
        receive_alerts = $7
      RETURNING *
    `, [studentId, reviewerId, permissions?.role || 'parent',
        permissions?.canViewAll !== false,
        permissions?.canFlag !== false,
        permissions?.canAddNotes !== false,
        permissions?.receiveAlerts !== false]);

    res.json({ success: true, reviewer: result.rows[0] });

  } catch (error) {
    console.error('Add reviewer error:', error);
    res.status(500).json({ success: false, message: 'Failed to add reviewer' });
  }
});

// Helper function to check review permission
async function checkReviewPermission(userId, studentId) {
  if (userId === studentId) return true;

  // Check if user is a registered reviewer
  const reviewerResult = await query(`
    SELECT * FROM conversation_reviewers
    WHERE student_id = $1 AND reviewer_id = $2
  `, [studentId, userId]);

  if (reviewerResult.rows.length > 0) return true;

  // Check if user is parent/guardian
  const familyResult = await query(`
    SELECT * FROM family_connections 
    WHERE student_id = $1 AND (parent_id = $2 OR guardian_id = $2)
  `, [studentId, userId]);

  if (familyResult.rows.length > 0) return true;

  // Check if user is teacher
  const classResult = await query(`
    SELECT * FROM class_students cs
    JOIN classes c ON cs.class_id = c.id
    WHERE cs.student_id = $1 AND c.teacher_id = $2
  `, [studentId, userId]);

  return classResult.rows.length > 0;
}

module.exports = router;
