/**
 * StudyQuest Rebuild - Project Routes
 * Project lifecycle management with AI-generated scope
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// Create new project with AI-generated scope
router.post('/', authenticateToken, async (req, res) => {
  console.log('🚀 POST /projects received', req.body);
  const { topic, goal, subject } = req.body;
  const userId = req.user.id;
  console.log('👤 userId:', userId, 'topic:', topic, 'subject:', subject);

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    // Generate project scope via AI (outside transaction)
    const scope = await kimiService.generateProjectScope(topic, goal);

    // Insert project in a short transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const projectResult = await client.query(
        `INSERT INTO projects (
          user_id, title, description, deliverable, 
          topic, skill_tree, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          userId,
          scope.title,
          scope.description,
          scope.deliverable,
          topic,
          JSON.stringify(scope.skillTree),
          'active'
        ]
      );

      const project = projectResult.rows[0];
      await client.query('COMMIT');

      console.log('✅ Project created:', project.id);
      res.status(201).json({
        success: true,
        project: {
          ...project,
          skillTree: scope.skillTree
        }
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get all projects for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT p.*, 
        (SELECT COUNT(*) FROM chapters 
         WHERE project_id = p.id AND status = 'completed') as completed_chapters,
        (SELECT COUNT(*) FROM chapters 
         WHERE project_id = p.id) as total_chapters
      FROM projects p
      WHERE p.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND p.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await db.query(query, params);

    res.json({ projects: result.rows });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with chapters
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get project
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get chapters
    const chaptersResult = await db.query(
      `SELECT id, chapter_number, title, context, status, 
              completed_at, created_at
       FROM chapters 
       WHERE project_id = $1 
       ORDER BY chapter_number`,
      [id]
    );

    // Get skill tree
    const skillTreeResult = await db.query(
      `SELECT * FROM skill_tree_templates 
       ORDER BY id`
    );

    // Get artifacts count
    const artifactsResult = await db.query(
      'SELECT COUNT(*) FROM knowledge_artifacts WHERE project_id = $1',
      [id]
    );

    // Get active boss battle if any
    const bossResult = await db.query(
      `SELECT id, title, status, current_stage 
       FROM boss_battles 
       WHERE project_id = $1 AND status = 'in_progress'`,
      [id]
    );

    res.json({
      project: {
        ...project,
        skillTree: skillTreeResult.rows
      },
      chapters: chaptersResult.rows,
      artifactsCount: parseInt(artifactsResult.rows[0].count),
      activeBossBattle: bossResult.rows[0] || null
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// AI suggest next chapter or boss battle
router.post('/:id/suggest-next', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get project with chapters
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get completed chapters
    const chaptersResult = await db.query(
      `SELECT title, status FROM chapters 
       WHERE project_id = $1
       ORDER BY chapter_number`,
      [id]
    );

    const completedChapters = chaptersResult.rows.filter(c => c.status === 'completed');
    const totalChapters = chaptersResult.rows.length;

    // Check if boss battle is available (after 2+ chapters)
    const canStartBoss = completedChapters.length >= 2;

    // Check if there's an active boss battle
    const activeBoss = await db.query(
      `SELECT id FROM boss_battles 
       WHERE project_id = $1 AND user_id = $2 AND status = 'in_progress'`,
      [id, userId]
    );

    res.json({
      projectId: id,
      completedChapters: completedChapters.length,
      suggestions: {
        nextChapter: !canStartBoss || totalChapters === 0,
        bossBattle: canStartBoss && activeBoss.rows.length === 0,
        resumeBoss: activeBoss.rows.length > 0
      },
      nextChapterSkill: completedChapters.length < (project.skill_tree?.length || 0)
        ? project.skill_tree?.[completedChapters.length]?.name 
        : 'Final Project',
      activeBossId: activeBoss.rows[0]?.id || null
    });

  } catch (error) {
    console.error('Error suggesting next:', error);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

// Update project
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, status } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, userId);

    const result = await db.query(
      `UPDATE projects SET ${updates.join(', ')} 
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: result.rows[0] });

  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, message: 'Project deleted' });

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
