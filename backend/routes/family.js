const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Helper: Generate a clean 6-character code
function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---------------------------------------------------------
// 1. STUDENT: Generate a Connection Code
// POST /api/family/generate-code
// ---------------------------------------------------------
router.post('/generate-code', async (req, res) => {
  const studentId = req.user.id;
  const userRole = req.user.role;

  try {
    // Verify user is a student
    if (userRole === 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Only students can generate invite codes'
      });
    }

    // Invalidate any existing unused codes for this student
    await db.query(
      'UPDATE connection_codes SET used = true WHERE student_id = $1 AND used = false',
      [studentId]
    );

    // Generate new code
    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const result = await db.query(
      `INSERT INTO connection_codes (code, student_id, expires_at, used)
       VALUES ($1, $2, $3, false)
       RETURNING code, expires_at`,
      [code, studentId, expiresAt]
    );

    res.status(201).json({
      success: true,
      code: result.rows[0].code,
      expiresAt: result.rows[0].expires_at,
      expiresInMinutes: 15
    });

  } catch (err) {
    console.error('❌ Generate Code Error:', err);
    res.status(500).json({ success: false, message: 'Server error generating code' });
  }
});

// ---------------------------------------------------------
// 2. PARENT: Link to Student using Code (with transaction)
// POST /api/family/link-child
// ---------------------------------------------------------
router.post('/link-child', async (req, res) => {
  const parentId = req.user.id;
  const userRole = req.user.role;
  const { code, relationship = 'Guardian' } = req.body;

  console.log('🔗 Link attempt:', { parentId, userRole, code, relationship });

  if (!code) {
    return res.status(400).json({ success: false, message: 'Code is required' });
  }

  // Verify user is a parent
  if (userRole !== 'parent') {
    return res.status(403).json({
      success: false,
      message: 'Only parent accounts can link to students'
    });
  }

  // Use getClient() for transaction support
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Find the code (case-insensitive)
    const codeRes = await client.query(
      `SELECT id, student_id, expires_at, used 
       FROM connection_codes 
       WHERE code = $1`,
      [code.toUpperCase().trim()]
    );

    console.log('📝 Code lookup result:', codeRes.rows.length, 'rows found');

    if (codeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }

    const codeRecord = codeRes.rows[0];

    // Check if already used
    if (codeRecord.used) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Code has already been used' });
    }

    // Check expiration
    if (new Date() > new Date(codeRecord.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Code has expired' });
    }

    // Check if already linked
    const existingLink = await client.query(
      `SELECT id FROM family_links WHERE guardian_id = $1 AND student_id = $2`,
      [parentId, codeRecord.student_id]
    );

    if (existingLink.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You are already linked to this student'
      });
    }

    // Create the link
    await client.query(
      `INSERT INTO family_links (guardian_id, student_id, relationship)
       VALUES ($1, $2, $3)`,
      [parentId, codeRecord.student_id, relationship]
    );

    // Mark code as used
    await client.query(
      'UPDATE connection_codes SET used = true WHERE id = $1',
      [codeRecord.id]
    );

    // Get student info for response
    const studentRes = await client.query(
      `SELECT id, full_name, username, level 
       FROM students WHERE id = $1`,
      [codeRecord.student_id]
    );

    await client.query('COMMIT');

    const student = studentRes.rows[0];

    console.log('✅ Successfully linked parent to student:', student.username);

    res.status(201).json({
      success: true,
      student: {
        id: student.id,
        fullName: student.full_name || student.username,
        username: student.username,
        level: student.level || 1
      },
      message: `Successfully linked to ${student.full_name || student.username}`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Link Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error linking account',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// 3. PARENT: Get list of linked students with stats
// GET /api/family/children-stats
// ---------------------------------------------------------
router.get('/children-stats', async (req, res) => {
  const parentId = req.user.id;

  console.log(`🔍 Fetching children for parent ID: ${parentId}`);

  try {
    const result = await db.query(
      `SELECT 
        s.id,
        s.full_name,
        s.username,
        s.level,
        s.xp,
        s.current_streak,
        s.total_study_time,
        fl.relationship,
        fl.created_at as connected_at
       FROM family_links fl
       JOIN students s ON s.id = fl.student_id
       WHERE fl.guardian_id = $1
       ORDER BY fl.created_at DESC`,
      [parentId]
    );

    console.log(`✅ Found ${result.rows.length} children`);

    const children = result.rows.map(row => ({
      id: row.id,
      fullName: row.full_name || row.username,
      username: row.username,
      level: row.level || 1,
      xp: row.xp || 0,
      currentStreak: row.current_streak || 0,
      totalStudyTime: row.total_study_time || 0,
      relationship: row.relationship || 'Guardian',
      connectedAt: row.connected_at
    }));

    res.json({ success: true, children });

  } catch (err) {
    console.error('❌ Children Stats Error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching children stats',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ---------------------------------------------------------
// 4. STUDENT: Get list of connected guardians
// GET /api/family/guardians
// ---------------------------------------------------------
router.get('/guardians', async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await db.query(
      `SELECT 
        fl.id as link_id,
        fl.guardian_id,
        s.full_name,
        s.username,
        s.email,
        fl.relationship,
        fl.created_at as connected_at
       FROM family_links fl
       JOIN students s ON s.id = fl.guardian_id
       WHERE fl.student_id = $1
       ORDER BY fl.created_at DESC`,
      [studentId]
    );

    const guardians = result.rows.map(row => ({
      linkId: row.link_id,
      guardianId: row.guardian_id,
      name: row.full_name || row.username,
      email: row.email,
      relationship: row.relationship || 'Guardian',
      connectedAt: row.connected_at
    }));

    res.json({ success: true, guardians });

  } catch (err) {
    console.error('❌ Get Guardians Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching guardians' });
  }
});

// ---------------------------------------------------------
// 5. STUDENT: Remove a guardian link
// DELETE /api/family/guardians/:linkId
// ---------------------------------------------------------
router.delete('/guardians/:linkId', async (req, res) => {
  const studentId = req.user.id;
  const { linkId } = req.params;

  try {
    const linkResult = await db.query(
      'SELECT id, student_id FROM family_links WHERE id = $1',
      [linkId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    if (linkResult.rows[0].student_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only remove your own guardian links'
      });
    }

    await db.query('DELETE FROM family_links WHERE id = $1', [linkId]);

    res.json({ success: true, message: 'Guardian removed successfully' });

  } catch (err) {
    console.error('❌ Remove Guardian Error:', err);
    res.status(500).json({ success: false, message: 'Error removing guardian' });
  }
});

// ---------------------------------------------------------
// 6. PARENT: Remove a child link
// DELETE /api/family/children/:studentId
// ---------------------------------------------------------
router.delete('/children/:studentId', async (req, res) => {
  const parentId = req.user.id;
  const { studentId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM family_links WHERE guardian_id = $1 AND student_id = $2 RETURNING id',
      [parentId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    res.json({ success: true, message: 'Child removed successfully' });

  } catch (err) {
    console.error('❌ Remove Child Error:', err);
    res.status(500).json({ success: false, message: 'Error removing child' });
  }
});

module.exports = router;