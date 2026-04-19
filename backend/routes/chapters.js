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
  // Override global timeout for this heavy AI endpoint (Render limit is ~100s)
  req.setTimeout(90000);
  res.setTimeout(90000);
  console.log('🚀 POST /chapters/generate received', req.body);
  const { projectId, userRequest, context } = req.body;
  const userId = req.user.id;
  console.log('👤 userId:', userId, 'projectId:', projectId, 'userRequest:', userRequest);

  try {
    // Get project and previous chapters for context (read-only, no transaction)
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get previous chapter titles for context
    const prevChapters = await db.query(
      `SELECT title, content FROM chapters 
       WHERE project_id = $1 AND status = 'completed'
       ORDER BY chapter_number`,
      [projectId]
    );

    const previousTitles = prevChapters.rows.map(c => c.title);
    const lastChapter = prevChapters.rows.length > 0 ? prevChapters.rows[prevChapters.rows.length - 1] : null;
    const previousContext = lastChapter
      ? {
          title: lastChapter.title,
          keyPoints: lastChapter.content?.keyPoints || []
        }
      : null;

    // Determine next chapter number (avoid duplicates)
    const maxChapterRes = await db.query(
      `SELECT COALESCE(MAX(chapter_number), 0) as max_num FROM chapters WHERE project_id = $1`,
      [projectId]
    );
    const nextChapterNumber = parseInt(maxChapterRes.rows[0].max_num) + 1;

    // Generate chapter content via AI (outside transaction)
    const chapterContent = await kimiService.generateChapter({
      topic: project.title,
      chapterNumber: nextChapterNumber,
      skillName: userRequest || `Chapter ${nextChapterNumber}`,
      projectContext: project.description,
      deliverable: project.deliverable,
      previousContext
    });

    // Build content JSONB (questions are now generated in the same AI call as the chapter)
    const content = {
      keyPoints: chapterContent.keyPoints,
      fullLesson: chapterContent.fullLesson,
      whyItMatters: chapterContent.whyItMatters,
      questions: chapterContent.questions || []
    };

    // Short transaction for INSERT + UPDATE only
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const chapterResult = await client.query(
        `INSERT INTO chapters (
          project_id, chapter_number, title, 
          focus_area, context, content, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          projectId, nextChapterNumber,
          userRequest || `Chapter ${nextChapterNumber}`,
          chapterContent.focus || userRequest || `Chapter ${previousTitles.length + 1}`,
          chapterContent.context || project.description,
          JSON.stringify(content),
          'available'
        ]
      );

      await client.query(
        'UPDATE projects SET current_chapter = $1 WHERE id = $2',
        [chapterResult.rows[0].chapter_number, projectId]
      );

      await client.query('COMMIT');
      console.log('✅ Chapter generated successfully:', chapterResult.rows[0].id);

      const row = chapterResult.rows[0];
      res.json({
        success: true,
        chapter: {
          ...row,
          full_lesson: row.content?.fullLesson,
          key_points: row.content?.keyPoints,
          why_it_matters: row.content?.whyItMatters,
          questions: row.content?.questions
        }
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error generating chapter:', error);
    res.status(500).json({ error: 'Failed to generate chapter' });
  }
});

// List chapters for a project
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.query;

    let query = `
      SELECT c.*, p.title as project_title,
        c.content->>'fullLesson' as full_lesson,
        c.content->'keyPoints' as key_points,
        c.content->>'whyItMatters' as why_it_matters,
        c.content->'questions' as questions
      FROM chapters c
      JOIN projects p ON c.project_id = p.id
      WHERE p.user_id = $1
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
    const userId = req.user.id;

    const result = await db.query(
      `SELECT c.*, p.title as project_title, p.deliverable,
        c.content->>'fullLesson' as full_lesson,
        c.content->'keyPoints' as key_points,
        c.content->>'whyItMatters' as why_it_matters,
        c.content->'questions' as questions
       FROM chapters c
       JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1 AND p.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = result.rows[0];

    // If chapter is available, mark as in_progress when fetched
    if (chapter.status === 'available') {
      await db.query(
        `UPDATE chapters SET status = 'in_progress' WHERE id = $1`,
        [id]
      );
      chapter.status = 'in_progress';
    }

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
  const userId = req.user.id;

  try {
    // Get chapter (verify ownership via project join)
    const chapterResult = await db.query(
      `SELECT c.*,
        c.content->>'fullLesson' as full_lesson,
        c.content->'keyPoints' as key_points
       FROM chapters c
       JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1 AND p.user_id = $2`,
      [id, userId]
    );

    if (chapterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult.rows[0];

    // Mark chapter as completed (autocommit so row lock is released immediately)
    await db.query(
      `UPDATE chapters 
       SET status = 'completed', completed_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    // Check if artifact already exists (idempotent for double-clicks)
    const existingArtifact = await db.query(
      `SELECT * FROM knowledge_artifacts WHERE chapter_id = $1 LIMIT 1`,
      [id]
    );

    if (existingArtifact.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Chapter already completed',
        artifact: existingArtifact.rows[0]
      });
    }

    // Generate knowledge artifact (slow AI call — no DB transaction held)
    const keyPoints = Array.isArray(chapter.key_points)
      ? chapter.key_points
      : (chapter.key_points || []);

    const artifact = await kimiService.generateKnowledgeArtifact({
      topic: chapter.title,
      chapterTitle: chapter.title,
      focusArea: chapter.context,
      keyPoints: keyPoints,
      fullLesson: chapter.full_lesson
    });

    // Save artifact
    const artifactResult = await db.query(
      `INSERT INTO knowledge_artifacts (
        project_id, chapter_id, user_id, title, content, 
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

    res.json({
      success: true,
      message: 'Chapter completed and artifact created',
      artifact: artifactResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error completing chapter:', error);
    res.status(500).json({ error: 'Failed to complete chapter' });
  }
});

module.exports = router;
