/**
 * StudyQuest Rebuild - Chapter Routes
 * On-demand single chapter generation with context
 * Now async: returns immediately, generates in background
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// Track in-progress chapter generations per project (in-memory)
const generatingProjects = new Set();

// Generate a single chapter (async — returns immediately)
router.post('/generate', authenticateToken, async (req, res) => {
  console.log('🚀 POST /chapters/generate received', req.body);
  const { projectId, userRequest, context } = req.body;
  const userId = req.user.id;
  console.log('👤 userId:', userId, 'projectId:', projectId, 'userRequest:', userRequest);

  try {
    // Get project
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Determine next chapter number
    const maxChapterRes = await db.query(
      `SELECT COALESCE(MAX(chapter_number), 0) as max_num FROM chapters WHERE project_id = $1`,
      [projectId]
    );
    const nextChapterNumber = (parseInt(maxChapterRes.rows[0].max_num) || 0) + 1;

    // Check if chapter already exists
    const existingChapter = await db.query(
      `SELECT * FROM chapters WHERE project_id = $1 AND chapter_number = $2`,
      [projectId, nextChapterNumber]
    );

    if (existingChapter.rows.length > 0) {
      console.log('📖 Chapter already exists, returning:', existingChapter.rows[0].id);
      const row = existingChapter.rows[0];
      return res.json({
        success: true,
        chapter: {
          ...row,
          full_lesson: row.content?.fullLesson,
          key_points: row.content?.keyPoints,
          why_it_matters: row.content?.whyItMatters,
          questions: row.content?.questions
        }
      });
    }

    // Check if generation is already in progress
    if (generatingProjects.has(projectId)) {
      console.log('⏳ Chapter generation already in progress for project:', projectId);
      return res.json({ success: true, status: 'generating' });
    }

    // Mark as generating and return immediately
    generatingProjects.add(projectId);
    res.json({ success: true, status: 'generating' });

    // Get user tier info for age-appropriate content
    const userResult = await db.query(
      `SELECT age_tier, form_level FROM students WHERE id = $1`,
      [userId]
    );
    const tierInfo = userResult.rows[0] || null;

    // Generate in background (fire-and-forget)
    generateChapterInBackground(projectId, userId, project, nextChapterNumber, userRequest, tierInfo);

  } catch (error) {
    console.error('❌ Error generating chapter:', error);
    res.status(500).json({ error: 'Failed to generate chapter' });
  }
});

async function generateChapterInBackground(projectId, userId, project, nextChapterNumber, userRequest, tierInfo) {
  console.log(`🚀 [Background] Starting chapter ${nextChapterNumber} generation for project: ${projectId}, topic: ${project.title}`);
  try {
    // Get previous chapters for context
    const prevChapters = await db.query(
      `SELECT title, content FROM chapters 
       WHERE project_id = $1 AND status = 'completed'
       ORDER BY chapter_number`,
      [projectId]
    );

    const previousTitles = prevChapters.rows.map(c => c.title);
    const lastChapter = prevChapters.rows.length > 0 ? prevChapters.rows[prevChapters.rows.length - 1] : null;
    const previousContext = lastChapter
      ? { title: lastChapter.title, keyPoints: lastChapter.content?.keyPoints || [] }
      : null;

    // Generate chapter content via AI
    const chapterContent = await kimiService.generateChapter({
      topic: project.title,
      chapterNumber: nextChapterNumber,
      skillName: userRequest || `Chapter ${nextChapterNumber}`,
      projectContext: project.description,
      deliverable: project.deliverable,
      previousContext,
      tierInfo
    });

    const content = {
      keyPoints: chapterContent.keyPoints,
      fullLesson: chapterContent.fullLesson,
      whyItMatters: chapterContent.whyItMatters,
      questions: chapterContent.questions || []
    };

    // Insert chapter
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
          chapterContent.focus || userRequest || `Chapter ${nextChapterNumber}`,
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
      console.log('✅ Background chapter generated:', chapterResult.rows[0].id);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('❌ Background chapter insert failed:', error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Background chapter generation failed:', error);
  } finally {
    generatingProjects.delete(projectId);
  }
}

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
  console.log(`🎯 Completing chapter ${id} for user ${userId}`);

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
      console.warn('⚠️ Chapter not found:', id);
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult.rows[0];
    console.log('📖 Chapter found:', chapter.title);

    // Mark chapter as completed
    await db.query(
      `UPDATE chapters 
       SET status = 'completed', completed_at = NOW() 
       WHERE id = $1`,
      [id]
    );
    console.log('✅ Chapter marked as completed');

    // Check if artifact already exists (idempotent for double-clicks)
    const existingArtifact = await db.query(
      `SELECT * FROM knowledge_artifacts WHERE chapter_id = $1 LIMIT 1`,
      [id]
    );

    if (existingArtifact.rows.length > 0) {
      console.log('🎨 Artifact already exists');
      return res.json({
        success: true,
        message: 'Chapter already completed',
        artifact: existingArtifact.rows[0]
      });
    }

    // Generate knowledge artifact
    const keyPoints = Array.isArray(chapter.key_points)
      ? chapter.key_points
      : (chapter.key_points || []);

    console.log('🤖 Generating artifact for:', chapter.title);
    const artifact = await kimiService.generateKnowledgeArtifact({
      topic: chapter.title,
      chapterTitle: chapter.title,
      focusArea: chapter.context,
      keyPoints: keyPoints,
      fullLesson: chapter.full_lesson
    });
    console.log('🎨 Artifact generated:', artifact?.title);

    // Validate artifact shape before inserting
    const safeArtifact = {
      title: artifact?.title || `${chapter.title} Reference`,
      content: artifact?.content || keyPoints.map(kp => `- ${kp}`).join('\n'),
      summary: artifact?.summary || `Reference for ${chapter.context}`,
      tags: Array.isArray(artifact?.tags) ? artifact.tags : [chapter.title.toLowerCase(), 'reference']
    };

    // Save artifact
    const artifactResult = await db.query(
      `INSERT INTO knowledge_artifacts (
        project_id, chapter_id, user_id, title, content, 
        summary, tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        chapter.project_id, id, userId,
        safeArtifact.title,
        safeArtifact.content,
        safeArtifact.summary,
        safeArtifact.tags
      ]
    );
    console.log('💾 Artifact saved:', artifactResult.rows[0].id);

    res.json({
      success: true,
      message: 'Chapter completed and artifact created',
      artifact: artifactResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error completing chapter:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to complete chapter', details: error.message });
  }
});

module.exports = router;
