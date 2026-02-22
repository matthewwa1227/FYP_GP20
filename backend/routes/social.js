const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// STUDY GROUPS
// ============================================

// GET /api/social/groups - Get study groups
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { myGroups, subject } = req.query;

    let sql = `
      SELECT 
        sg.*,
        s.username as creator_name,
        COUNT(sgm.id) as member_count,
        EXISTS(SELECT 1 FROM study_group_members WHERE group_id = sg.id AND student_id = $1) as is_member
      FROM study_groups sg
      JOIN students s ON sg.creator_id = s.id
      LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id
      WHERE 1=1
    `;
    const params = [studentId];
    let paramIndex = 2;

    if (myGroups === 'true') {
      sql += ` AND EXISTS(SELECT 1 FROM study_group_members WHERE group_id = sg.id AND student_id = $1)`;
    }

    if (subject) {
      sql += ` AND sg.subject = $${paramIndex++}`;
      params.push(subject);
    }

    sql += ` GROUP BY sg.id, s.username ORDER BY sg.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, groups: result.rows });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ success: false, message: 'Failed to load groups' });
  }
});

// POST /api/social/groups - Create study group
router.post('/groups', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { name, description, subject, topics, isPrivate, maxMembers } = req.body;

    const joinCode = isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;

    const result = await query(`
      INSERT INTO study_groups (
        name, description, subject, topics, is_private, join_code,
        max_members, creator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, description, subject, JSON.stringify(topics || []), isPrivate, joinCode, maxMembers || 10, studentId]);

    // Add creator as admin
    await query(`
      INSERT INTO study_group_members (group_id, student_id, role)
      VALUES ($1, $2, 'admin')
    `, [result.rows[0].id, studentId]);

    res.json({ success: true, group: result.rows[0] });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
});

// POST /api/social/groups/:id/join - Join study group
router.post('/groups/:id/join', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const groupId = req.params.id;
    const { joinCode } = req.body;

    // Check if group exists and is joinable
    const groupResult = await query(`
      SELECT * FROM study_groups WHERE id = $1
    `, [groupId]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupResult.rows[0];

    if (group.is_private && group.join_code !== joinCode) {
      return res.status(403).json({ success: false, message: 'Invalid join code' });
    }

    // Check capacity
    const countResult = await query(`
      SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1
    `, [groupId]);

    if (parseInt(countResult.rows[0].count) >= group.max_members) {
      return res.status(400).json({ success: false, message: 'Group is full' });
    }

    // Join group
    await query(`
      INSERT INTO study_group_members (group_id, student_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT DO NOTHING
    `, [groupId, studentId]);

    res.json({ success: true, message: 'Joined group successfully' });

  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ success: false, message: 'Failed to join group' });
  }
});

// GET /api/social/groups/:id - Get group details
router.get('/groups/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const groupId = req.params.id;

    const groupResult = await query(`
      SELECT sg.*, s.username as creator_name
      FROM study_groups sg
      JOIN students s ON sg.creator_id = s.id
      WHERE sg.id = $1
    `, [groupId]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const membersResult = await query(`
      SELECT sgm.*, s.username, s.full_name, s.avatar_url, s.level
      FROM study_group_members sgm
      JOIN students s ON sgm.student_id = s.id
      WHERE sgm.group_id = $1
      ORDER BY sgm.role, s.username
    `, [groupId]);

    res.json({
      success: true,
      group: groupResult.rows[0],
      members: membersResult.rows
    });

  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({ success: false, message: 'Failed to load group' });
  }
});

// ============================================
// FRIENDS
// ============================================

// GET /api/social/friends - Get friends list
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT 
        f.*,
        CASE 
          WHEN f.requester_id = $1 THEN s2.username
          ELSE s1.username
        END as friend_username,
        CASE 
          WHEN f.requester_id = $1 THEN s2.full_name
          ELSE s1.full_name
        END as friend_name,
        CASE 
          WHEN f.requester_id = $1 THEN s2.avatar_url
          ELSE s1.avatar_url
        END as friend_avatar,
        CASE 
          WHEN f.requester_id = $1 THEN s2.level
          ELSE s1.level
        END as friend_level
      FROM friendships f
      JOIN students s1 ON f.requester_id = s1.id
      JOIN students s2 ON f.addressee_id = s2.id
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
    `, [studentId]);

    res.json({ success: true, friends: result.rows });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ success: false, message: 'Failed to load friends' });
  }
});

// GET /api/social/friends/requests - Get friend requests
router.get('/friends/requests', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT 
        f.*,
        s.username, s.full_name, s.avatar_url, s.level
      FROM friendships f
      JOIN students s ON f.requester_id = s.id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
    `, [studentId]);

    res.json({ success: true, requests: result.rows });

  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to load requests' });
  }
});

// POST /api/social/friends/request - Send friend request
router.post('/friends/request', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { username } = req.body;

    // Find user by username
    const userResult = await query(`
      SELECT id FROM students WHERE username = $1
    `, [username]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const friendId = userResult.rows[0].id;

    if (friendId === studentId) {
      return res.status(400).json({ success: false, message: 'Cannot add yourself' });
    }

    // Create friend request
    await query(`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (requester_id, addressee_id) DO NOTHING
    `, [studentId, friendId]);

    res.json({ success: true, message: 'Friend request sent' });

  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ success: false, message: 'Failed to send request' });
  }
});

// PUT /api/social/friends/:id/respond - Respond to friend request
router.put('/friends/:id/respond', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const requestId = req.params.id;
    const { action } = req.body; // 'accept' or 'decline'

    if (action === 'accept') {
      await query(`
        UPDATE friendships
        SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND addressee_id = $2
      `, [requestId, studentId]);
    } else {
      await query(`
        UPDATE friendships
        SET status = 'declined', responded_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND addressee_id = $2
      `, [requestId, studentId]);
    }

    res.json({ success: true, message: `Friend request ${action}ed` });

  } catch (error) {
    console.error('Respond request error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
});

// GET /api/social/feed - Get friends activity feed
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT 
        fa.*,
        s.username, s.full_name, s.avatar_url
      FROM friend_activities fa
      JOIN students s ON fa.student_id = s.id
      WHERE fa.student_id IN (
        SELECT CASE 
          WHEN requester_id = $1 THEN addressee_id
          ELSE requester_id
        END
        FROM friendships
        WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
      )
      AND fa.is_public = TRUE
      ORDER BY fa.created_at DESC
      LIMIT 50
    `, [studentId]);

    res.json({ success: true, activities: result.rows });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to load feed' });
  }
});

// ============================================
// CHALLENGES
// ============================================

// GET /api/social/challenges - Get challenges
router.get('/challenges', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { type, status } = req.query;

    let sql = `
      SELECT 
        c.*,
        cp.current_value, cp.progress_percentage, cp.completed, cp.completed_at, cp.rank,
        COUNT(cp2.id) as participant_count
      FROM challenges c
      LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id AND cp.student_id = $1
      LEFT JOIN challenge_participants cp2 ON c.id = cp2.challenge_id
      WHERE c.is_active = TRUE
    `;
    const params = [studentId];
    let paramIndex = 2;

    if (type) {
      sql += ` AND c.challenge_type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ` GROUP BY c.id, cp.current_value, cp.progress_percentage, cp.completed, cp.completed_at, cp.rank`;

    if (status === 'joined') {
      sql += ` HAVING cp.student_id IS NOT NULL`;
    } else if (status === 'available') {
      sql += ` HAVING cp.student_id IS NULL`;
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, challenges: result.rows });

  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ success: false, message: 'Failed to load challenges' });
  }
});

// POST /api/social/challenges/:id/join - Join challenge
router.post('/challenges/:id/join', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const challengeId = req.params.id;

    await query(`
      INSERT INTO challenge_participants (challenge_id, student_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [challengeId, studentId]);

    res.json({ success: true, message: 'Joined challenge' });

  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({ success: false, message: 'Failed to join challenge' });
  }
});

// GET /api/social/challenges/:id/leaderboard - Get challenge leaderboard
router.get('/challenges/:id/leaderboard', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;

    const result = await query(`
      SELECT 
        cp.*,
        s.username, s.full_name, s.avatar_url, s.level
      FROM challenge_participants cp
      JOIN students s ON cp.student_id = s.id
      WHERE cp.challenge_id = $1
      ORDER BY cp.progress_percentage DESC, cp.completed_at ASC
      LIMIT 20
    `, [challengeId]);

    res.json({ success: true, leaderboard: result.rows });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load leaderboard' });
  }
});

module.exports = router;
