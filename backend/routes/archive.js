/**
 * Archive Alchemist - Document Ingestion Portal
 * Upload PDF/DOCX/PPT/URL → AI generates study notes, flashcards, summary
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const contentService = require('../services/contentService');
const kimiService = require('../services/kimiService');

// Ensure uploads directory exists (Render ephemeral filesystem)
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|md|pdf|docx|pptx|jpg|jpeg|png|webp|gif)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only TXT, MD, PDF, DOCX, PPTX, and images (JPG, PNG, WebP, GIF) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.use(authenticateToken);

// ============================================
// HELPER: Generate archive notes in background
// ============================================
async function generateArchiveNotesInBackground(sessionId, text, title, userId) {
  const SAFETY_TIMEOUT_MS = 90000; // 90 seconds absolute max
  let completed = false;

  // Safety net: if anything hangs forever, force-mark as failed
  const safetyTimer = setTimeout(async () => {
    if (completed) return;
    console.error(`⏰ [Archive ${sessionId}] SAFETY TIMEOUT: forcing failed status after ${SAFETY_TIMEOUT_MS}ms`);
    try {
      await db.query(
        `UPDATE archive_sessions
         SET status = 'failed',
             error_message = $1,
             updated_at = NOW()
         WHERE id = $2`,
        ['The Alchemist timed out. The AI service took too long to respond. Please try again with a shorter document.', sessionId]
      );
    } catch (dbErr) {
      console.error(`❌ [Archive ${sessionId}] Failed to write safety timeout status:`, dbErr.message);
    }
  }, SAFETY_TIMEOUT_MS);

  let lastError = null;

  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🔄 [Archive ${sessionId}] Attempt ${attempt}/2`);

        // Get user's tier info for age-appropriate content
        const userRes = await db.query(
          'SELECT age_tier, form_level FROM students WHERE id = $1',
          [userId]
        );
        const dbTier = userRes.rows[0] || {};
        const tierInfo = {
          ageTier: dbTier.age_tier || null,
          formLevel: dbTier.form_level || null
        };

        // Hard timeout per attempt: 45 seconds
        const result = await Promise.race([
          kimiService.generateArchiveNotes(text, title, tierInfo),
          new Promise((_, reject) => {
            const t = setTimeout(() => reject(new Error('Attempt timed out after 45s')), 45000);
            if (t.unref) t.unref();
          })
        ]);

        await db.query(
          `UPDATE archive_sessions
           SET generated_notes = $1,
               flashcards = $2,
               summary = $3,
               master_artifact = $4,
               status = 'completed',
               xp_earned = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            JSON.stringify(result.notes || {}),
            JSON.stringify(result.flashcards || []),
            result.summary || '',
            JSON.stringify(result.masterArtifact || {}),
            result.xpEarned || 150,
            sessionId
          ]
        );

        console.log(`✅ [Archive ${sessionId}] Completed on attempt ${attempt}`);
        completed = true;
        return;

      } catch (error) {
        lastError = error;
        console.error(`❌ [Archive ${sessionId}] Attempt ${attempt} failed:`, error.message || error);
        if (attempt < 2) {
          console.log(`⏳ [Archive ${sessionId}] Retrying in 3 seconds...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    // All attempts failed — mark as failed
    console.error(`❌ [Archive ${sessionId}] All attempts failed.`);
    await db.query(
      `UPDATE archive_sessions
       SET status = 'failed',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [lastError?.message || 'Generation failed after 2 attempts', sessionId]
    );
    completed = true;

  } catch (fatalError) {
    // Catch ANY unexpected error in the outer logic
    console.error(`💥 [Archive ${sessionId}] FATAL error in background worker:`, fatalError.message || fatalError);
    try {
      await db.query(
        `UPDATE archive_sessions
         SET status = 'failed',
             error_message = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [fatalError?.message || 'Unexpected error in background generation', sessionId]
      );
    } catch (dbErr) {
      console.error(`❌ [Archive ${sessionId}] Failed to write fatal error status:`, dbErr.message);
    }
    completed = true;
  } finally {
    clearTimeout(safetyTimer);
  }
}

// ============================================
// POST /api/archive/upload
// ============================================
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document uploaded' });
    }

    const file = req.file;
    console.log(`📜 Archive upload: ${file.originalname} (${file.size} bytes)`);

    // Try Kimi File API extraction first, fallback to local parsers
    let processed = await contentService.processDocument(file.path, file.mimetype);

    if (processed.success) {
      try {
        const kimiText = await kimiService.extractDocumentWithKimi(file.path);
        if (kimiText && kimiText.length > 50) {
          processed.content = kimiText;
          processed.source = 'kimi';
          console.log(`✅ Kimi extraction succeeded: ${kimiText.length} chars`);
        }
      } catch (kimiErr) {
        console.warn(`⚠️ Kimi extraction failed, using local parser: ${kimiErr.message}`);
      }
    }

    if (!processed.success) {
      return res.status(400).json({
        success: false,
        message: processed.error || 'Failed to process document'
      });
    }

    // Create session
    const insertRes = await db.query(
      `INSERT INTO archive_sessions
       (user_id, title, source_type, filename, original_name, mime_type,
        original_text, word_count, char_count, status)
       VALUES ($1, $2, 'upload', $3, $4, $5, $6, $7, $8, 'processing')
       RETURNING *`,
      [
        userId,
        processed.title || file.originalname,
        file.filename,
        file.originalname,
        file.mimetype,
        processed.content,
        processed.wordCount,
        processed.charCount
      ]
    );

    const session = insertRes.rows[0];

    // Trigger background generation
    setImmediate(() => {
      generateArchiveNotesInBackground(
        session.id,
        processed.content,
        processed.title || file.originalname,
        userId
      );
    });

    res.json({
      success: true,
      sessionId: session.id,
      title: session.title,
      status: 'processing',
      message: 'Document uploaded! The Alchemist is transmuting your notes...'
    });

  } catch (error) {
    console.error('Archive upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
});

// ============================================
// POST /api/archive/url
// ============================================
router.post('/url', async (req, res) => {
  try {
    const userId = req.user.id;
    const { url } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    console.log(`🌐 Archive URL fetch: ${url}`);

    const fetched = await contentService.fetchUrlContent(url);

    if (!fetched.success) {
      return res.status(400).json({
        success: false,
        message: fetched.error || 'Failed to fetch URL'
      });
    }

    // Create session
    const insertRes = await db.query(
      `INSERT INTO archive_sessions
       (user_id, title, source_type, source_url,
        original_text, word_count, char_count, status)
       VALUES ($1, $2, 'url', $3, $4, $5, $6, 'processing')
       RETURNING *`,
      [
        userId,
        fetched.title || 'Web Document',
        url,
        fetched.content,
        fetched.wordCount,
        fetched.content.length
      ]
    );

    const session = insertRes.rows[0];

    // Trigger background generation
    setImmediate(() => {
      generateArchiveNotesInBackground(
        session.id,
        fetched.content,
        fetched.title || 'Web Document',
        userId
      );
    });

    res.json({
      success: true,
      sessionId: session.id,
      title: session.title,
      status: 'processing',
      message: 'URL summoned! The Alchemist is transmuting your notes...'
    });

  } catch (error) {
    console.error('Archive URL error:', error);
    res.status(500).json({ success: false, message: 'Failed to process URL' });
  }
});

// ============================================
// GET /api/archive - List user's sessions
// ============================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT id, title, source_type, source_url, original_name,
              status, xp_earned, summary,
              created_at, updated_at
       FROM archive_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const countRes = await db.query(
      'SELECT COUNT(*) FROM archive_sessions WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      sessions: result.rows,
      total: parseInt(countRes.rows[0].count)
    });

  } catch (error) {
    console.error('Archive list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// ============================================
// GET /api/archive/:id - Get single session
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM archive_sessions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const session = result.rows[0];

    res.json({
      success: true,
      session: {
        ...session,
        generated_notes: typeof session.generated_notes === 'string'
          ? JSON.parse(session.generated_notes)
          : session.generated_notes,
        flashcards: typeof session.flashcards === 'string'
          ? JSON.parse(session.flashcards)
          : session.flashcards,
        master_artifact: typeof session.master_artifact === 'string'
          ? JSON.parse(session.master_artifact)
          : session.master_artifact
      }
    });

  } catch (error) {
    console.error('Archive get error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
});

// ============================================
// DELETE /api/archive/:id
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM archive_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, message: 'Session deleted' });

  } catch (error) {
    console.error('Archive delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
});

// ============================================
// POST /api/archive/:id/regenerate
// ============================================
router.post('/:id/regenerate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT original_text, title FROM archive_sessions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const session = result.rows[0];

    // Reset status
    await db.query(
      `UPDATE archive_sessions
       SET status = 'processing', error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Trigger regeneration
    setImmediate(() => {
      generateArchiveNotesInBackground(id, session.original_text, session.title, userId);
    });

    res.json({
      success: true,
      status: 'processing',
      message: 'Transmutation restarted! New notes are brewing...'
    });

  } catch (error) {
    console.error('Archive regenerate error:', error);
    res.status(500).json({ success: false, message: 'Failed to regenerate' });
  }
});

module.exports = router;
