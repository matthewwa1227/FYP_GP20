/**
 * Newquest - Boss Battle Routes
 * Multi-stage synthesis verification with backward tracing & hotfix mode
 * Compatible with 015_studyquest_rebuild.sql schema
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// ============================================
// HELPER: Parse JSONB fields
// ============================================
function parseJSONB(field) {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return field;
}

// ============================================
// GET / - List user's boss battles
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.id;
    const { projectId } = req.query;

    let queryText = `
      SELECT bb.*, p.title as project_title 
      FROM boss_battles bb
      JOIN projects p ON bb.project_id = p.id
      WHERE bb.user_id = $1
    `;
    const params = [userId];

    if (projectId) {
      queryText += ` AND bb.project_id = $2`;
      params.push(projectId);
    }

    queryText += ` ORDER BY bb.created_at DESC`;

    const result = await db.query(queryText, params);

    res.json({
      success: true,
      battles: result.rows
    });

  } catch (error) {
    console.error('❌ Error listing boss battles:', error);
    res.status(500).json({ success: false, error: 'Failed to list boss battles' });
  }
});

// ============================================
// POST /start - Initialize a boss battle
// ============================================
router.post('/start', authenticateToken, async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.studentId || req.user.id;

  console.log(`🎮 Starting Newquest boss battle for project ${projectId}, user ${userId}`);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify project exists and belongs to user
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get all completed artifacts for this project
    const artifactsResult = await client.query(
      `SELECT id, title, content as summary, tags FROM knowledge_artifacts 
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [projectId, userId]
    );

    // Get completed chapters for this project
    const chaptersResult = await client.query(
      `SELECT id, chapter_number, title FROM chapters 
       WHERE project_id = $1 AND status = 'completed'
       ORDER BY chapter_number`,
      [projectId]
    );

    if (artifactsResult.rows.length === 0 && chaptersResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Complete at least one chapter before starting the boss battle' 
      });
    }

    // Check for existing active battle
    const existingResult = await client.query(
      `SELECT * FROM boss_battles 
       WHERE project_id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [projectId, userId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      await client.query('COMMIT');
      return res.json({
        success: true,
        bossBattle: existing,
        message: 'Resuming existing boss battle',
        resumed: true
      });
    }

    // Generate boss battle via AI
    const battle = await kimiService.generateBossBattle({
      topic: project.title,
      deliverable: project.deliverable,
      artifacts: artifactsResult.rows,
      chapters: chaptersResult.rows,
      skillTree: project.skill_tree || []
    });

    // Build full spec metadata
    const metadata = {
      suggestedAt: new Date().toISOString(),
      initiatedAt: new Date().toISOString(),
      completedAt: null,
      badgeTier: null,
      allowedDownshifts: 2,
      usedDownshifts: 0,
      retakeCount: 0,
      totalStages: battle.stages.length,
      chapterIds: chaptersResult.rows.map(c => c.id)
    };

    // Enrich stages with full spec structure
    const enrichedStages = battle.stages.map((stage, idx) => ({
      id: stage.id || require('crypto').randomUUID(),
      stageNumber: idx + 1,
      requiredChapters: stage.requiredChapters || [],
      scenario: stage.scenario || stage.task,
      deliverable: stage.deliverable,
      title: stage.title,
      task: stage.task,
      relevantArtifacts: stage.relevantArtifacts || [],
      validationCriteria: stage.validationCriteria || [],
      solution: {
        userSubmission: null,
        validationResult: null,
        executionTrace: null
      },
      retryState: {
        attempts: 0,
        lastFailureMode: null,
        microChallengeCompleted: false,
        holisticRetryRequired: false
      },
      uiState: {
        leftPanel: null,
        rightPanel: null,
        artifactGlow: stage.relevantArtifacts || []
      }
    }));

    // Create boss battle record
    const battleResult = await client.query(
      `INSERT INTO boss_battles (
        project_id, user_id, title, description, scenario,
        deliverable, stages, current_stage, total_stages, status,
        badge_earned, metadata, stage_solutions, started_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        projectId, userId, battle.title, battle.description,
        battle.scenario, battle.deliverable,
        JSON.stringify(enrichedStages), 1, enrichedStages.length, 'in_progress',
        `${project.title} Master`,
        JSON.stringify(metadata),
        JSON.stringify([])
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      bossBattle: battleResult.rows[0],
      stages: enrichedStages,
      metadata,
      message: 'Boss battle initiated!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error starting boss battle:', error);
    res.status(500).json({ success: false, error: 'Failed to start boss battle' });
  } finally {
    client.release();
  }
});

// ============================================
// GET /:id - Get boss battle state
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId || req.user.id;

    const result = await db.query(
      `SELECT bb.*, p.title as project_title, p.skill_tree 
       FROM boss_battles bb
       JOIN projects p ON bb.project_id = p.id
       WHERE bb.id = $1 AND bb.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    const stages = parseJSONB(battle.stages) || [];
    const metadata = parseJSONB(battle.metadata) || {};
    const stageSolutions = parseJSONB(battle.stage_solutions) || [];
    const masterArtifact = parseJSONB(battle.master_artifact);

    // Get artifacts for reference
    const artifactsResult = await db.query(
      `SELECT id, title, content as summary FROM knowledge_artifacts 
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [battle.project_id, userId]
    );

    // Get hotfix history
    const hotfixesResult = await db.query(
      `SELECT * FROM boss_battle_hotfixes 
       WHERE boss_battle_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [id, userId]
    );

    // Get previous attempts for retake comparison
    const attemptsResult = await db.query(
      `SELECT * FROM boss_battle_attempts 
       WHERE boss_battle_id = $1 AND user_id = $2
       ORDER BY attempt_number DESC`,
      [id, userId]
    );

    const currentStageIndex = (battle.current_stage || 1) - 1;
    const currentStage = stages[currentStageIndex] || null;
    const isHotfixMode = battle.failed_stage !== null && battle.failed_stage < currentStageIndex + 1;

    res.json({
      success: true,
      bossBattle: battle,
      stages,
      currentStage,
      currentStageIndex,
      metadata,
      stageSolutions,
      masterArtifact,
      artifacts: artifactsResult.rows,
      hotfixes: hotfixesResult.rows,
      previousAttempts: attemptsResult.rows,
      progress: {
        completed: currentStageIndex,
        total: stages.length,
        percentage: Math.round((currentStageIndex / stages.length) * 100),
        isHotfixMode,
        failedStage: battle.failed_stage,
        badgeTier: battle.badge_tier,
        canDownshift: (metadata.allowedDownshifts || 2) > (metadata.usedDownshifts || 0) && stages.length > 2
      }
    });

  } catch (error) {
    console.error('❌ Error fetching boss battle:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch boss battle' });
  }
});

// ============================================
// POST /:id/stage - Submit stage solution
// ============================================
router.post('/:id/stage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { solution, mode = 'normal' } = req.body;
  const userId = req.user.studentId || req.user.id;

  if (solution === undefined || solution === null) {
    return res.status(400).json({ success: false, error: 'Solution is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const battleResult = await client.query(
      'SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (battleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = battleResult.rows[0];
    const stages = parseJSONB(battle.stages) || [];
    const metadata = parseJSONB(battle.metadata) || {};
    let stageSolutions = parseJSONB(battle.stage_solutions) || [];

    // Determine which stage we're validating (1-based)
    let targetStageIndex = (battle.current_stage || 1) - 1;
    
    // Hotfix mode: validating a previous stage
    if (mode === 'hotfix' && battle.failed_stage !== null) {
      targetStageIndex = battle.failed_stage - 1;
    }

    const currentStage = stages[targetStageIndex];
    if (!currentStage) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Invalid stage' });
    }

    // Get relevant artifacts by title
    const artifactTitles = currentStage.relevantArtifacts || [];
    const artifactsResult = await client.query(
      `SELECT * FROM knowledge_artifacts 
       WHERE project_id = $1 AND title = ANY($2)`,
      [battle.project_id, artifactTitles]
    );

    // Get previous stage solution for propagation check
    const previousSolution = targetStageIndex > 0 ? stageSolutions[targetStageIndex - 1] : null;

    // Validate solution via AI
    const validation = await kimiService.validateBossStage({
      stage: currentStage,
      userSolution: solution,
      artifacts: artifactsResult.rows,
      previousSolution: previousSolution?.solution,
      mode: 'boss-battle'
    });

    // Update stage with solution and validation
    stages[targetStageIndex].solution = {
      userSubmission: solution,
      validationResult: validation.passed ? 'passed' : 'failed',
      executionTrace: validation.executionTrace || null
    };

    // Record in stage_solutions array
    stageSolutions[targetStageIndex] = {
      stageNumber: targetStageIndex + 1,
      solution,
      passed: validation.passed,
      submittedAt: new Date().toISOString()
    };

    let response = {
      passed: validation.passed,
      stage: targetStageIndex + 1,
      totalStages: stages.length,
      mode
    };

    if (validation.passed) {
      // Check if we're in hotfix mode
      if (mode === 'hotfix' && battle.failed_stage !== null) {
        // Record the hotfix
        await client.query(
          `INSERT INTO boss_battle_hotfixes 
           (boss_battle_id, user_id, stage_number, original_solution, fixed_solution, validation_result, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [id, userId, targetStageIndex + 1, 
           JSON.stringify(previousSolution?.solution || {}), 
           solution, 
           JSON.stringify(validation)]
        );

        // Clear failed_stage and continue to current stage
        await client.query(
          `UPDATE boss_battles 
           SET failed_stage = NULL,
               ai_diagnosis = NULL,
               stages = $1,
               stage_solutions = $2
           WHERE id = $3`,
          [JSON.stringify(stages), JSON.stringify(stageSolutions), id]
        );

        response.status = 'hotfix-resolved';
        response.message = 'Hotfix successful! The upstream issue is resolved. You may now continue.';
        response.canContinue = true;
      } else {
        // Normal progression
        const nextStage = targetStageIndex + 2;
        
        if (nextStage > stages.length) {
          // Battle complete! Determine badge tier
          const hotfixesCount = (await client.query(
            `SELECT COUNT(*) as count FROM boss_battle_hotfixes WHERE boss_battle_id = $1`,
            [id]
          )).rows[0].count;

          const badgeTier = determineBadgeTier(metadata.usedDownshifts || 0, parseInt(hotfixesCount) || 0);

          // Generate master artifact
          const masterArtifact = await kimiService.generateKnowledgeArtifact({
            topic: battle.title,
            chapterTitle: 'Boss Battle Synthesis',
            focusArea: battle.deliverable,
            keyPoints: stages.map(s => s.title),
            fullLesson: JSON.stringify(stageSolutions)
          });

          metadata.completedAt = new Date().toISOString();
          metadata.badgeTier = badgeTier;

          await client.query(
            `UPDATE boss_battles 
             SET status = 'completed', 
                 current_stage = $1,
                 badge_earned = $2,
                 badge_tier = $3,
                 master_artifact = $4,
                 metadata = $5,
                 stages = $6,
                 stage_solutions = $7,
                 completed_at = NOW()
             WHERE id = $8`,
            [nextStage - 1, `${battle.title} Master`, badgeTier, JSON.stringify(masterArtifact), 
             JSON.stringify(metadata), JSON.stringify(stages), 
             JSON.stringify(stageSolutions), id]
          );
          
          response.status = 'victory';
          response.badge = badgeTier;
          response.message = `Congratulations! You've earned the ${badgeTier} badge!`;
          response.masterArtifact = masterArtifact;
        } else {
          // Progress to next stage
          await client.query(
            `UPDATE boss_battles 
             SET current_stage = $1,
                 stages = $2,
                 stage_solutions = $3
             WHERE id = $4`,
            [nextStage, JSON.stringify(stages), JSON.stringify(stageSolutions), id]
          );
          
          response.status = 'progress';
          response.nextStage = nextStage;
          response.message = `Stage ${targetStageIndex + 1} complete! Proceed to Stage ${nextStage}.`;
        }
      }
    } else {
      // Failed - provide diagnosis
      const retryState = stages[targetStageIndex].retryState;
      retryState.attempts += 1;

      // Determine failure mode
      if (validation.upstreamDependency !== null) {
        retryState.lastFailureMode = 'upstream-bug';
      } else if (validation.functionalEquivalence === false) {
        retryState.lastFailureMode = 'integration-failure';
      } else {
        retryState.lastFailureMode = 'sub-skill-gap';
      }

      // First failure: decomposed retry with micro-challenge
      // Second failure: holistic retry required
      if (retryState.attempts >= 2) {
        retryState.holisticRetryRequired = true;
      }

      stages[targetStageIndex].retryState = retryState;
      stages[targetStageIndex].uiState.leftPanel = targetStageIndex > 0 ? 'stage-n-minus-1' : null;
      stages[targetStageIndex].uiState.rightPanel = 'stage-n-preview';

      await client.query(
        `UPDATE boss_battles 
         SET failed_stage = $1,
             ai_diagnosis = $2,
             stages = $3,
             stage_solutions = $4
         WHERE id = $5`,
        [targetStageIndex + 1, validation.diagnosis, 
         JSON.stringify(stages), JSON.stringify(stageSolutions), id]
      );
      
      response.status = 'retry';
      response.diagnosis = validation.diagnosis;
      response.highlightedArtifacts = validation.highlightedArtifacts || [];
      response.hint = validation.hint;
      response.retryState = retryState;
      response.upstreamDependency = validation.upstreamDependency;
      response.isHotfixRequired = validation.upstreamDependency !== null;
      
      if (validation.upstreamDependency !== null) {
        response.hotfixMode = {
          targetStage: targetStageIndex + 1,
          sourceStage: validation.upstreamDependency,
          message: 'This failure traces back to a previous stage. Enter Hotfix Mode to repair the root cause.'
        };
      }
    }

    await client.query('COMMIT');
    res.json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error submitting stage:', error);
    res.status(500).json({ success: false, error: 'Failed to submit stage solution' });
  } finally {
    client.release();
  }
});

// ============================================
// POST /:id/retry - Get retry info for failed stage
// ============================================
router.post('/:id/retry', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId || req.user.id;

    const result = await db.query(
      `SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    
    if (battle.failed_stage === null) {
      return res.status(400).json({ success: false, error: 'No failed stage to retry' });
    }

    const stages = parseJSONB(battle.stages) || [];
    const failedStageData = stages[battle.failed_stage - 1];

    // Get relevant artifacts
    const artifactTitles = failedStageData.relevantArtifacts || [];
    const artifactsResult = await db.query(
      `SELECT * FROM knowledge_artifacts 
       WHERE project_id = $1 AND title = ANY($2)`,
      [battle.project_id, artifactTitles]
    );

    res.json({
      success: true,
      stage: battle.failed_stage,
      stageData: failedStageData,
      diagnosis: battle.ai_diagnosis,
      retryState: failedStageData.retryState,
      canRetry: true,
      artifacts: artifactsResult.rows,
      requiresHolisticRetry: failedStageData.retryState?.holisticRetryRequired || false
    });

  } catch (error) {
    console.error('❌ Error getting retry info:', error);
    res.status(500).json({ success: false, error: 'Failed to get retry information' });
  }
});

// ============================================
// POST /:id/downshift - Reduce difficulty
// ============================================
router.post('/:id/downshift', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.studentId || req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    const metadata = parseJSONB(battle.metadata) || {};
    const stages = parseJSONB(battle.stages) || [];

    if ((metadata.usedDownshifts || 0) >= (metadata.allowedDownshifts || 2)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No downshifts remaining' });
    }

    if (stages.length <= 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Cannot downshift below 2 stages' });
    }

    // Remove the last stage
    const removedStage = stages.pop();
    metadata.usedDownshifts = (metadata.usedDownshifts || 0) + 1;

    // Adjust current_stage if needed
    let currentStage = battle.current_stage || 1;
    if (currentStage > stages.length) {
      currentStage = stages.length;
    }

    await client.query(
      `UPDATE boss_battles 
       SET stages = $1,
           current_stage = $2,
           metadata = $3,
           used_downshifts = $4
       WHERE id = $5`,
      [JSON.stringify(stages), currentStage, JSON.stringify(metadata), 
       metadata.usedDownshifts, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Difficulty reduced. Stage "${removedStage.title}" removed.`,
      remainingStages: stages.length,
      usedDownshifts: metadata.usedDownshifts,
      allowedDownshifts: metadata.allowedDownshifts,
      warning: 'Using a downshift will cap your badge tier at Proficiency.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error downshifting:', error);
    res.status(500).json({ success: false, error: 'Failed to downshift' });
  } finally {
    client.release();
  }
});

// ============================================
// POST /:id/retake - Reset for retake
// ============================================
router.post('/:id/retake', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.studentId || req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM boss_battles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    const metadata = parseJSONB(battle.metadata) || {};
    const stages = parseJSONB(battle.stages) || [];
    const stageSolutions = parseJSONB(battle.stage_solutions) || [];

    // Save current attempt to history before resetting
    const attemptCount = (await client.query(
      `SELECT COUNT(*) as count FROM boss_battle_attempts WHERE boss_battle_id = $1`,
      [id]
    )).rows[0].count;

    await client.query(
      `INSERT INTO boss_battle_attempts 
       (boss_battle_id, user_id, attempt_number, badge_tier, stage_results, master_artifact, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, parseInt(attemptCount) + 1, battle.badge_tier, 
       JSON.stringify(stageSolutions), battle.master_artifact, battle.completed_at]
    );

    // Reset stages (keep structure but clear solutions)
    const resetStages = stages.map(stage => ({
      ...stage,
      solution: {
        userSubmission: null,
        validationResult: null,
        executionTrace: null
      },
      retryState: {
        attempts: 0,
        lastFailureMode: null,
        microChallengeCompleted: false,
        holisticRetryRequired: false
      }
    }));

    metadata.retakeCount = (metadata.retakeCount || 0) + 1;
    metadata.initiatedAt = new Date().toISOString();
    metadata.completedAt = null;
    metadata.badgeTier = null;

    await client.query(
      `UPDATE boss_battles 
       SET status = 'in_progress',
           current_stage = 1,
           failed_stage = NULL,
           ai_diagnosis = NULL,
           badge_earned = NULL,
           badge_tier = NULL,
           stages = $1,
           stage_solutions = $2,
           metadata = $3,
           retake_count = $4,
           completed_at = NULL
       WHERE id = $5`,
      [JSON.stringify(resetStages), JSON.stringify([]), 
       JSON.stringify(metadata), metadata.retakeCount, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Boss battle reset for retake. Previous attempt saved.',
      retakeNumber: metadata.retakeCount,
      stages: resetStages,
      metadata
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error retaking boss battle:', error);
    res.status(500).json({ success: false, error: 'Failed to retake boss battle' });
  } finally {
    client.release();
  }
});

// ============================================
// GET /:id/artifact - Get master artifact
// ============================================
router.get('/:id/artifact', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId || req.user.id;

    const result = await db.query(
      `SELECT master_artifact, badge_tier, title FROM boss_battles 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const battle = result.rows[0];
    const masterArtifact = parseJSONB(battle.master_artifact);

    if (!masterArtifact) {
      return res.status(400).json({ success: false, error: 'Master artifact not yet generated' });
    }

    res.json({
      success: true,
      masterArtifact,
      badgeTier: battle.badge_tier,
      title: battle.title
    });

  } catch (error) {
    console.error('❌ Error fetching artifact:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch artifact' });
  }
});

// ============================================
// POST /:id/artifact/curate - Update curated version
// ============================================
router.post('/:id/artifact/curate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { curatedContent } = req.body;
    const userId = req.user.studentId || req.user.id;

    const result = await db.query(
      `SELECT master_artifact FROM boss_battles 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Boss battle not found' });
    }

    const masterArtifact = parseJSONB(result.rows[0].master_artifact) || {};
    masterArtifact.curatedVersion = {
      content: curatedContent,
      updatedAt: new Date().toISOString()
    };

    await db.query(
      `UPDATE boss_battles SET master_artifact = $1 WHERE id = $2`,
      [JSON.stringify(masterArtifact), id]
    );

    res.json({
      success: true,
      message: 'Curated version saved'
    });

  } catch (error) {
    console.error('❌ Error curating artifact:', error);
    res.status(500).json({ success: false, error: 'Failed to save curated version' });
  }
});

// ============================================
// HELPER: Determine badge tier
// ============================================
function determineBadgeTier(usedDownshifts, hotfixCount) {
  if (usedDownshifts === 0 && hotfixCount === 0) {
    return 'mastery';
  }
  if (usedDownshifts <= 1 && hotfixCount <= 1) {
    return 'proficiency';
  }
  return 'completion';
}

module.exports = router;
