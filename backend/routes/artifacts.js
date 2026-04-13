/**
 * StudyQuest Rebuild - Artifact Routes
 * Knowledge Artifact management for open-book testing
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');

// Get all artifacts for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.studentId;
    const { search, tag } = req.query;

    let query = `
      SELECT ka.*, p.title as project_title 
      FROM knowledge_artifacts ka
      JOIN projects p ON ka.project_id = p.id
      WHERE ka.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (search) {
      query += ` AND (ka.title ILIKE $${paramIndex} OR ka.content_markdown ILIKE $${paramIndex} OR ka.summary ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (req.query.projectId) {
      query += ` AND ka.project_id = $${paramIndex}`;
      params.push(req.query.projectId);
      paramIndex++;
    }

    if (tag) {
      query += ` AND $${paramIndex} = ANY(ka.tags)`;
      params.push(tag);
      paramIndex++;
    }

    query += ` ORDER BY ka.created_at DESC`;

    const result = await db.query(query, params);

    res.json({ artifacts: result.rows });

  } catch (error) {
    console.error('Error fetching artifacts:', error);
    res.status(500).json({ error: 'Failed to fetch artifacts' });
  }
});

// Get single artifact
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId;

    const result = await db.query(
      `SELECT ka.*, p.title as project_title 
       FROM knowledge_artifacts ka
       JOIN projects p ON ka.project_id = p.id
       WHERE ka.id = $1 AND ka.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json({ artifact: result.rows[0] });

  } catch (error) {
    console.error('Error fetching artifact:', error);
    res.status(500).json({ error: 'Failed to fetch artifact' });
  }
});

// Get artifacts for project sidebar (used during chapters)
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.studentId;

    // Verify user owns this project
    const projectCheck = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get artifacts for this project
    const result = await db.query(
      `SELECT ka.id, ka.title, ka.content_markdown, ka.tags, 
              ka.summary, ka.created_at
       FROM knowledge_artifacts ka
       WHERE ka.project_id = $1 AND ka.user_id = $2
       ORDER BY ka.created_at DESC`,
      [projectId, userId]
    );

    res.json({ 
      artifacts: result.rows,
      canSearch: true,
      canEdit: false // Future: allow editing
    });

  } catch (error) {
    console.error('Error fetching project artifacts:', error);
    res.status(500).json({ error: 'Failed to fetch artifacts' });
  }
});

// Search artifacts
router.get('/search/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.studentId;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const result = await db.query(
      `SELECT ka.*, p.title as project_title 
       FROM knowledge_artifacts ka
       JOIN projects p ON ka.project_id = p.id
       WHERE ka.user_id = $1 
       AND (ka.title ILIKE $2 
            OR ka.content_markdown ILIKE $2 
            OR ka.summary ILIKE $2
            OR EXISTS (SELECT 1 FROM unnest(ka.tags) tag WHERE tag ILIKE $2))
       ORDER BY ka.created_at DESC`,
      [userId, `%${q}%`]
    );

    res.json({ artifacts: result.rows, query: q });

  } catch (error) {
    console.error('Error searching artifacts:', error);
    res.status(500).json({ error: 'Failed to search artifacts' });
  }
});

module.exports = router;
