/**
 * StudyQuest Rebuild - Attempt Routes
 * Answer submission with AI diagnostic feedback
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// Submit an attempt
router.post('/', authenticateToken, async (req, res) => {
  const { chapterId, questionType, userAnswer, questionIndex } = req.body;
  const userId = req.user.studentId;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get chapter with questions
    const chapterResult = await client.query(
      'SELECT * FROM chapters WHERE id = $1 AND user_id = $2',
      [chapterId, userId]
    );

    if (chapterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult.rows[0];
    const questions = typeof chapter.questions === 'string' 
      ? JSON.parse(chapter.questions) 
      : chapter.questions;

    const question = questions[questionIndex];
    if (!question) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid question index' });
    }

    // Check previous attempts
    const prevAttempts = await client.query(
      `SELECT COUNT(*) FROM chapter_attempts 
       WHERE chapter_id = $1 AND question_type = $2 AND user_id = $3`,
      [chapterId, questionType, userId]
    );
    const retryCount = parseInt(prevAttempts.rows[0].count);

    // Validate answer (simple comparison for now, can be enhanced with AI validation)
    let isCorrect = false;
    if (questionType === 'code_execution') {
      // For code questions, use AI to validate
      // Simplified: check if answer contains expected patterns
      isCorrect = userAnswer.toLowerCase().includes(question.correctAnswer.toLowerCase()) ||
                  userAnswer.trim() === question.correctAnswer.trim();
    } else {
      isCorrect = userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    }

    // Generate AI diagnosis if wrong
    let diagnosis = null;
    if (!isCorrect) {
      diagnosis = await kimiService.generateDiagnosis({
        question: question,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        previousAttempts: retryCount
      });
    }

    // Get relevant artifact for reference
    const artifactResult = await client.query(
      `SELECT id FROM knowledge_artifacts 
       WHERE chapter_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [chapterId]
    );

    // Save attempt
    const attemptResult = await client.query(
      `INSERT INTO chapter_attempts (
        chapter_id, user_id, question_type, question_index,
        user_answer, is_correct, ai_diagnosis, ai_mini_lesson,
        retry_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        chapterId, userId, questionType, questionIndex,
        userAnswer, isCorrect,
        diagnosis?.diagnosis || null,
        diagnosis?.miniLesson || null,
        retryCount
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      attempt: attemptResult.rows[0],
      isCorrect,
      diagnosis: isCorrect ? null : {
        message: diagnosis?.diagnosis,
        miniLesson: diagnosis?.miniLesson,
        hint: diagnosis?.hint,
        misconception: diagnosis?.misconception
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting attempt:', error);
    res.status(500).json({ error: 'Failed to submit attempt' });
  } finally {
    client.release();
  }
});

// Get attempt details with diagnosis
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.studentId;

    const result = await db.query(
      `SELECT ca.*, c.title as chapter_title, c.project_id 
       FROM chapter_attempts ca
       JOIN chapters c ON ca.chapter_id = c.id
       WHERE ca.id = $1 AND ca.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.json({ attempt: result.rows[0] });

  } catch (error) {
    console.error('Error fetching attempt:', error);
    res.status(500).json({ error: 'Failed to fetch attempt' });
  }
});

// Retry an attempt (get mini-lesson)
router.post('/:id/retry', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.studentId;

  try {
    // Get the attempt
    const attemptResult = await db.query(
      'SELECT * FROM chapter_attempts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    // Get related artifacts
    const artifactsResult = await db.query(
      `SELECT * FROM knowledge_artifacts 
       WHERE chapter_id = $1 ORDER BY created_at DESC`,
      [attempt.chapter_id]
    );

    res.json({
      attempt: attempt,
      miniLesson: attempt.ai_mini_lesson,
      artifacts: artifactsResult.rows,
      canRetry: true
    });

  } catch (error) {
    console.error('Error getting retry info:', error);
    res.status(500).json({ error: 'Failed to get retry information' });
  }
});

module.exports = router;
