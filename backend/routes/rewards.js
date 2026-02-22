const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/rewards - Get rewards for a student
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.student?.id || req.user?.id;
    const userId = req.student?.id || req.user?.id;

    // Check permission
    const hasPermission = await checkRewardPermission(userId, studentId);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to view rewards' });
    }

    const result = await query(`
      SELECT 
        sr.*,
        rd.title as reward_definition_title,
        rd.description as reward_definition_description,
        rd.reward_type,
        rd.icon,
        rd.color,
        rd.reward_value
      FROM student_rewards sr
      LEFT JOIN reward_definitions rd ON sr.reward_id = rd.id
      WHERE sr.student_id = $1
      ORDER BY 
        CASE sr.status 
          WHEN 'unlocked' THEN 1 
          WHEN 'locked' THEN 2 
          ELSE 3 
        END,
        sr.created_at DESC
    `, [studentId]);

    res.json({ success: true, rewards: result.rows });

  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({ success: false, message: 'Failed to load rewards' });
  }
});

// ============================================
// POST /api/rewards/definitions - Create a reward definition (parent/teacher)
// ============================================
router.post('/definitions', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const userRole = req.user?.role || 'parent';
    const {
      title, description, rewardType, requirementType, requirementValue,
      requirementDescription, icon, color, rewardValue, deliveryMethod,
      collaboratorIds
    } = req.body;

    const result = await query(`
      INSERT INTO reward_definitions (
        created_by, creator_role, title, description, reward_type,
        requirement_type, requirement_value, requirement_description,
        icon, color, reward_value, delivery_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [userId, userRole, title, description, rewardType, requirementType,
        requirementValue, requirementDescription, icon, color, rewardValue, deliveryMethod]);

    const rewardDef = result.rows[0];

    // Add collaborators if specified
    if (collaboratorIds && collaboratorIds.length > 0) {
      for (const collabId of collaboratorIds) {
        await query(`
          INSERT INTO reward_collaborations (reward_id, collaborator_id, collaborator_role)
          VALUES ($1, $2, 'parent')
          ON CONFLICT DO NOTHING
        `, [rewardDef.id, collabId]);
      }
    }

    res.json({ success: true, reward: rewardDef });

  } catch (error) {
    console.error('Create reward error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reward' });
  }
});

// ============================================
// POST /api/rewards/assign - Assign reward to student
// ============================================
router.post('/assign', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const { studentId, rewardDefinitionId, customReward } = req.body;

    // Check permission
    const hasPermission = await checkRewardPermission(userId, studentId);
    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to assign rewards' });
    }

    let rewardId = rewardDefinitionId;
    let rewardData = customReward;

    // If using a reward definition, get its details
    if (rewardDefinitionId) {
      const defResult = await query(`
        SELECT * FROM reward_definitions WHERE id = $1
      `, [rewardDefinitionId]);

      if (defResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Reward definition not found' });
      }

      const def = defResult.rows[0];
      rewardData = {
        title: def.title,
        description: def.description,
        reward_type: def.reward_type,
        icon: def.icon,
        color: def.color,
        reward_value: def.reward_value
      };
    }

    const result = await query(`
      INSERT INTO student_rewards (
        student_id, reward_id, reward_title, reward_description,
        reward_type, status
      ) VALUES ($1, $2, $3, $4, $5, 'locked')
      RETURNING *
    `, [studentId, rewardId, rewardData.title, rewardData.description, rewardData.reward_type]);

    res.json({ success: true, assignment: result.rows[0] });

  } catch (error) {
    console.error('Assign reward error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign reward' });
  }
});

// ============================================
// PUT /api/rewards/:id/claim - Claim a reward (student)
// ============================================
router.put('/:id/claim', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const rewardId = req.params.id;

    const result = await query(`
      UPDATE student_rewards
      SET status = 'claimed',
          claimed_at = CURRENT_TIMESTAMP,
          claim_notes = $1
      WHERE id = $2 AND student_id = $3 AND status = 'unlocked'
      RETURNING *
    `, [req.body.notes, rewardId, studentId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reward not available for claim' });
    }

    res.json({ success: true, reward: result.rows[0] });

  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim reward' });
  }
});

// ============================================
// PUT /api/rewards/:id/approve - Approve/Deliver reward (parent/teacher)
// ============================================
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const rewardId = req.params.id;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    // Get reward details
    const rewardResult = await query(`
      SELECT sr.*, rd.created_by as reward_creator
      FROM student_rewards sr
      LEFT JOIN reward_definitions rd ON sr.reward_id = rd.id
      WHERE sr.id = $1
    `, [rewardId]);

    if (rewardResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }

    const reward = rewardResult.rows[0];

    // Check permission (must be creator or collaborator)
    const hasPermission = reward.reward_creator === userId || 
                         await checkRewardPermission(userId, reward.student_id);

    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'No permission to approve rewards' });
    }

    if (action === 'approve') {
      const result = await query(`
        UPDATE student_rewards
        SET status = 'delivered',
            delivery_status = 'delivered',
            claimed_by = $1,
            delivery_notes = $2
        WHERE id = $3
        RETURNING *
      `, [userId, notes, rewardId]);

      res.json({ success: true, reward: result.rows[0] });
    } else {
      const result = await query(`
        UPDATE student_rewards
        SET status = 'locked',
            rejection_reason = $1,
            rejected_by = $2,
            rejected_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [notes, userId, rewardId]);

      res.json({ success: true, reward: result.rows[0] });
    }

  } catch (error) {
    console.error('Approve reward error:', error);
    res.status(500).json({ success: false, message: 'Failed to process reward' });
  }
});

// ============================================
// GET /api/rewards/collaborations - Get reward collaborations
// ============================================
router.get('/collaborations', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT 
        rc.*,
        rd.title as reward_title,
        s.username as collaborator_name
      FROM reward_collaborations rc
      JOIN reward_definitions rd ON rc.reward_id = rd.id
      JOIN students s ON rc.collaborator_id = s.id
      WHERE rd.created_by = $1 OR rc.collaborator_id = $1
    `, [userId]);

    res.json({ success: true, collaborations: result.rows });

  } catch (error) {
    console.error('Get collaborations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load collaborations' });
  }
});

// ============================================
// POST /api/rewards/collaborations - Add collaborator
// ============================================
router.post('/collaborations', authenticateToken, async (req, res) => {
  try {
    const userId = req.student?.id || req.user?.id;
    const { rewardId, collaboratorId, permissions } = req.body;

    // Check ownership
    const rewardResult = await query(`
      SELECT * FROM reward_definitions WHERE id = $1 AND created_by = $2
    `, [rewardId, userId]);

    if (rewardResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await query(`
      INSERT INTO reward_collaborations (
        reward_id, collaborator_id, collaborator_role,
        can_edit, can_approve_claims, can_view_progress
      ) VALUES ($1, $2, 'parent', $3, $4, $5)
      ON CONFLICT (reward_id, collaborator_id) 
      DO UPDATE SET 
        can_edit = $3,
        can_approve_claims = $4,
        can_view_progress = $5
      RETURNING *
    `, [rewardId, collaboratorId, permissions?.canEdit || false, 
        permissions?.canApproveClaims || true, permissions?.canViewProgress || true]);

    res.json({ success: true, collaboration: result.rows[0] });

  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ success: false, message: 'Failed to add collaborator' });
  }
});

// Helper function to check reward permissions
async function checkRewardPermission(userId, studentId) {
  if (userId === studentId) return true;

  // Check if user is parent/guardian
  const familyResult = await query(`
    SELECT * FROM family_connections 
    WHERE (student_id = $1 AND parent_id = $2) OR (student_id = $1 AND guardian_id = $2)
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
