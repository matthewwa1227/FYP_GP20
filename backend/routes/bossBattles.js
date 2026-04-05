/**
 * StudyQuest Rebuild - Boss Battle Routes
 * Multi-stage synthesis challenges
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// Initialize a boss battle
router.post('/start', authenticateToken, async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.studentId;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify project exists and belongs to user
    const projectResult = await client.query(
      'SELECT * FROM user_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get all completed artifacts for this project
    const artifactsResult = await client.query(
      `SELECT id, title, summary, tags FROM knowledge_artifacts 
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [projectId, userId]
    );

    if (artifactsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Complete at least one chapter before starting boss battle' });
    }

    // Generate boss battle via AI
    const battle = await kimiService.generateBossBattle({
      topic: project.title,
      deliverable: project.deliverable,
      artifacts: artifactsResult.rows,
      skillTree: project.skill_tree || []
    });

    // Create boss battle record
    const battleResult = await client.query(
      `INSERT INTO boss_battles (
        project_id, user_id, title, description, scenario,
        deliverable, stages, current_stage, status, badge_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        projectId, userId, battle.title, battle.description,
        battle.scenario, battle.deliverable,
        JSON.stringify(battle.stages), 0, 'active',
        `${project.title} Master`
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      bossBattle: battleResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting boss battle:', error);
    res.status(500).json({ error: 'Failed to start boss battle' });
  } finally {
    client.release();
  }
});

// Get boss battle state
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId;

    const result = await db.query(
      `SELECT bb.*, p.title as project_title 
       FROM boss_battles bb
       JOIN user_projects p ON bb.project_id = p.id
       WHERE bb.id = $1 AND bb.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    const stages = typeof battle.stages === 'string' 
      ? JSON.parse(battle.stages) 
      : battle.stages;

    // Get artifacts for reference
    const artifactsResult = await db.query(
      `SELECT * FROM knowledge_artifacts 
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [battle.project_id, userId]
    );

    res.json({
      bossBattle: battle,
      stages,
      currentStage: stages[battle.current_stage],
      artifacts: artifactsResult.rows,
      progress: {
        completed: battle.current_stage,
        total: stages.length,
        percentage: Math.round((battle.current_stage / stages.length) * 100)
      }
    });

  } catch (error) {
    console.error('Error fetching boss battle:', error);
    res.status(500).json({ error: 'Failed to fetch boss battle' });
  }
});

// Submit stage solution
router.post('/:id/stage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { solution } = req.body;
  const userId = req.user.studentId;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get boss battle
    const battleResult = await client.query(
      'SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (battleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Boss battle not found' });
    }

    const battle = battleResult.rows[0];
    const stages = typeof battle.stages === 'string' 
      ? JSON.parse(battle.stages) 
      : battle.stages;

    const currentStage = stages[battle.current_stage];

    if (!currentStage) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid stage' });
    }

    // Get relevant artifacts
    const artifactIds = currentStage.relevantArtifacts || [];
    const artifactsResult = await client.query(
      `SELECT * FROM knowledge_artifacts 
       WHERE project_id = $1 AND title = ANY($2)`,
      [battle.project_id, artifactIds]
    );

    // Validate solution via AI
    const validation = await kimiService.validateBossStage({
      stage: currentStage,
      userSolution: solution,
      artifacts: artifactsResult.rows
    });

    let response = {
      passed: validation.passed,
      stage: battle.current_stage + 1,
      totalStages: stages.length
    };

    if (validation.passed) {
      // Update to next stage or complete
      const nextStage = battle.current_stage + 1;
      
      if (nextStage >= stages.length) {
        // Battle complete!
        await client.query(
          `UPDATE boss_battles 
           SET status = 'completed', 
               current_stage = $1,
               completed_at = NOW()
           WHERE id = $2`,
          [nextStage, id]
        );
        
        response.status = 'victory';
        response.badge = battle.badge_name;
        response.message = `Congratulations! You've earned the ${battle.badge_name} badge!`;
      } else {
        // Progress to next stage
        await client.query(
          `UPDATE boss_battles 
           SET current_stage = $1
           WHERE id = $2`,
          [nextStage, id]
        );
        
        response.status = 'progress';
        response.nextStage = nextStage + 1;
      }
    } else {
      // Failed - provide diagnosis
      await client.query(
        `UPDATE boss_battles 
         SET failed_stage = $1,
             ai_diagnosis = $2
         WHERE id = $3`,
        [battle.current_stage, validation.diagnosis, id]
      );
      
      response.status = 'retry';
      response.diagnosis = validation.diagnosis;
      response.highlightedArtifacts = validation.highlightedArtifacts;
      response.hint = validation.hint;
    }

    await client.query('COMMIT');
    res.json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting stage:', error);
    res.status(500).json({ error: 'Failed to submit stage solution' });
  } finally {
    client.release();
  }
});

// Retry failed stage
router.post('/:id/retry', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId;

    const result = await db.query(
      `SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    
    if (battle.failed_stage === null) {
      return res.status(400).json({ error: 'No failed stage to retry' });
    }

    const stages = typeof battle.stages === 'string' 
      ? JSON.parse(battle.stages) 
      : battle.stages;

    const failedStageData = stages[battle.failed_stage];

    res.json({
      stage: battle.failed_stage + 1,
      stageData: failedStageData,
      diagnosis: battle.ai_diagnosis,
      canRetry: true
    });

  } catch (error) {
    console.error('Error getting retry info:', error);
    res.status(500).json({ error: 'Failed to get retry information' });
  }
});

module.exports = router;
