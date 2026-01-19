const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Helper: Generate 6-char random code
const generateCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

// ==========================================
// STUDENT ROUTE: Generate Link Code
// ==========================================
router.post('/generate-code', authenticateToken, async (req, res) => {
    // TODO: Ensure req.user is actually a student
    const studentId = req.student.id; 
    const client = await pool.connect();

    try {
        // 1. Clean up old codes for this student
        await client.query('DELETE FROM connection_codes WHERE student_id = $1', [studentId]);

        // 2. Generate new code (valid for 15 mins)
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 15 * 60000); // Now + 15 mins

        await client.query(
            'INSERT INTO connection_codes (code, student_id, expires_at) VALUES ($1, $2, $3)',
            [code, studentId, expiresAt]
        );

        res.json({
            success: true,
            code: code,
            expiresIn: '15 minutes'
        });

    } catch (error) {
        console.error('Error generating code:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// ==========================================
// PARENT ROUTE: Link Child
// ==========================================
router.post('/link-child', authenticateToken, async (req, res) => {
    // TODO: Ensure req.user is a parent
    const parentId = req.user.id; 
    const { code } = req.body;

    const client = await pool.connect();

    try {
        // 1. Find valid code
        const codeResult = await client.query(
            `SELECT student_id FROM connection_codes 
             WHERE code = $1 AND expires_at > NOW()`,
            [code.toUpperCase()]
        );

        if (codeResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        }

        const studentId = codeResult.rows[0].student_id;

        // 2. Check if already linked
        const existingLink = await client.query(
            'SELECT * FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
            [parentId, studentId]
        );

        if (existingLink.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Already linked to this student' });
        }

        // 3. Create Link
        await client.query(
            'INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2)',
            [parentId, studentId]
        );

        // 4. Delete the used code
        await client.query('DELETE FROM connection_codes WHERE code = $1', [code]);

        res.json({ success: true, message: 'Successfully linked to student!' });

    } catch (error) {
        console.error('Error linking child:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;