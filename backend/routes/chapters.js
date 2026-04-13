/**
 * StudyQuest Rebuild - Chapter Routes
 * On-demand single chapter generation with context
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// Generate a single chapter (on-demand)
router.post('/generate', authenticateToken, async (req, res) => {
  const { projectId, userRequest, context } = req.body;
  const userId = req.user.studentId;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get project and previous chapters for context
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get previous chapter titles for context
    const prevChapters = await client.query(
      `SELECT title, key_points FROM chapters 
       WHERE project_id = $1 AND status = 'completed'
       ORDER BY chapter_number`,
      [projectId]
    );

    const previousTitles = prevChapters.rows.map(c => c.title);
    const previousContext = prevChapters.rows.length > 0 
      ? {
          title: prevChapters.rows[prevChapters.rows.length - 1].title,
          keyPoints: prevChapters.rows[prevChapters.rows.length - 1].key_points || []
        }
      : null;

    // Generate chapter content via AI
    const chapterContent = await kimiService.generateChapter({
      topic: project.title,
      chapterNumber: previousTitles.length + 1,
      skillName: userRequest || `Chapter ${previousTitles.length + 1}`,
      projectContext: project.description,
      deliverable: project.deliverable,
      previousContext
    });

    // Generate questions
    const questions = await kimiService.generateQuestions({
      topic: project.title,
      chapterTitle: userRequest || `Chapter ${previousTitles.length + 1}`,
      lessonContent: chapterContent.fullLesson,
      count: 3
    });

    // Insert chapter
    const chapterResult = await client.query(
      `INSERT INTO chapters (
        project_id, user_id, chapter_number, title, 
        context, key_points, full_lesson, why_it_matters,
        questions, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        projectId, userId, previousTitles.length + 1,
        userRequest || `Chapter ${previousTitles.length + 1}`,
        chapterContent.context,
        chapterContent.keyPoints,
        chapterContent.fullLesson,
        chapterContent.whyItMatters,
        JSON.stringify(questions),
        'active'
      ]
    );

    // Update project's current chapter
    await client.query(
      'UPDATE projects SET current_chapter_id = $1 WHERE id = $2',
      [chapterResult.rows[0].id, projectId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      chapter: chapterResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating chapter:', error);
    res.status(500).json({ error: 'Failed to generate chapter' });
  } finally {
    client.release();
  }
});

// List chapters for a project
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.studentId;
    const { projectId } = req.query;

    let query = `
      SELECT c.*, p.title as project_title 
      FROM chapters c
      JOIN projects p ON c.project_id = p.id
      WHERE c.user_id = $1
    `;
    const params = [userId];

    if (projectId) {
      query += ` AND c.project_id = $2`;
      params.push(projectId);
    }

    query += ` ORDER BY c.chapter_number`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      chapters: result.rows
    });

  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
});

// Get chapter details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId;

    const result = await db.query(
      `SELECT c.*, p.title as project_title, p.deliverable 
       FROM chapters c
       JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = result.rows[0];

    // Get user's artifacts for this project (for sidebar)
    const artifactsResult = await db.query(
      `SELECT id, title, summary FROM knowledge_artifacts 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [chapter.project_id]
    );

    res.json({
      chapter: {
        ...chapter,
        questions: typeof chapter.questions === 'string' 
          ? JSON.parse(chapter.questions) 
          : chapter.questions
      },
      artifacts: artifactsResult.rows
    });

  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Failed to fetch chapter' });
  }
});

// Complete chapter and generate artifact
router.post('/:id/complete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.studentId;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get chapter
    const chapterResult = await client.query(
      'SELECT * FROM chapters WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (chapterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult.rows[0];

    // Mark chapter as completed
    await client.query(
      `UPDATE chapters 
       SET status = 'completed', completed_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    // Generate knowledge artifact
    const artifact = await kimiService.generateKnowledgeArtifact({
      topic: chapter.title,
      chapterTitle: chapter.title,
      focusArea: chapter.context,
      keyPoints: Array.isArray(chapter.key_points) 
        ? chapter.key_points 
        : JSON.parse(chapter.key_points || '[]'),
      fullLesson: chapter.full_lesson
    });

    // Save artifact
    const artifactResult = await client.query(
      `INSERT INTO knowledge_artifacts (
        project_id, chapter_id, user_id, title, content_markdown, 
        summary, tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        chapter.project_id, id, userId,
        artifact.title,
        artifact.content,
        artifact.summary,
        artifact.tags
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Chapter completed and artifact created',
      artifact: artifactResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing chapter:', error);
    res.status(500).json({ error: 'Failed to complete chapter' });
  } finally {
    client.release();
  }
});

module.exports = router;
