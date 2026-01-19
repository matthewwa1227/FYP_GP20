const express = require('express');
const router = express.Router();
const db = require('../db/connection'); // Assumes this exports a pg.Pool
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes in this router
router.use(authenticateToken);

// ---------------------------------------------------------
// 1. STUDENT: Generate a Connection Code
// ---------------------------------------------------------
router.post('/generate-code', async (req, res) => {
    // req.user is now guaranteed by the middleware
    const studentId = req.user.id; 

    try {
        // Generate a random 6-character hex code
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const sql = `
            INSERT INTO connection_codes (code, student_id, expires_at)
            VALUES ($1, $2, $3)
            RETURNING code, expires_at
        `;
        
        const result = await db.query(sql, [code, studentId, expiresAt]);
        res.json({ success: true, code: result.rows[0].code });

    } catch (err) {
        console.error("Generate Code Error:", err);
        res.status(500).json({ success: false, message: "Server error generating code" });
    }
});

// ---------------------------------------------------------
// 2. PARENT: Link a Child using the Code
// ---------------------------------------------------------
router.post('/link-child', async (req, res) => {
    const parentId = req.user.id;
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, message: "Code is required" });
    }

    // Get a client for transaction
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // A. Find the code
        const codeRes = await client.query(
            `SELECT student_id, expires_at FROM connection_codes WHERE code = $1`, 
            [code]
        );

        if (codeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Invalid code" });
        }

        const { student_id, expires_at } = codeRes.rows[0];

        // B. Check expiration
        if (new Date() > new Date(expires_at)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Code expired" });
        }

        // C. Check if already linked
        const existingLink = await client.query(
            `SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
            [parentId, student_id]
        );

        if (existingLink.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Student already linked" });
        }

        // D. Create the link
        await client.query(
            `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2)`,
            [parentId, student_id]
        );

        // E. Fetch student details (for UI confirmation)
        const studentRes = await client.query(
            `SELECT full_name, current_level FROM students WHERE id = $1`,
            [student_id]
        );

        // F. Delete the used code (One-time use)
        await client.query(`DELETE FROM connection_codes WHERE code = $1`, [code]);

        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            student: studentRes.rows[0],
            message: "Successfully linked!" 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Linking Error:", err);
        res.status(500).json({ success: false, message: "Server error linking account" });
    } finally {
        client.release();
    }
});
// ---------------------------------------------------------
// 3. PARENT: Get Dashboard Stats (DEBUG VERSION)
// ---------------------------------------------------------
router.get('/children-stats', async (req, res) => {
    // 1. Debug: Check if we actually have the user ID from the token
    if (!req.user || !req.user.id) {
        console.error("❌ Auth Error: req.user is missing or has no ID", req.user);
        return res.status(401).json({ success: false, message: "User not identified" });
    }

    const parentId = req.user.id;
    console.log(`🔍 Fetching stats for Parent ID: ${parentId}`);

    try {
        // 2. Debug: Use a safer query first to test connection
        // If this works, add back the other columns (avatar_url, etc) one by one.
        const sql = `
            SELECT 
                s.id, 
                s.full_name, 
                s.current_level
                -- s.avatar_url,         <-- Commented out for safety
                -- s.total_points,       <-- Commented out for safety
                -- s.streak_days,        <-- Commented out for safety
                -- s.total_study_minutes <-- Commented out for safety
            FROM parent_student_links psl
            JOIN students s ON psl.student_id = s.id
            WHERE psl.parent_id = $1
        `;
        
        const result = await db.query(sql, [parentId]);
        
        console.log(`✅ Found ${result.rows.length} children`);
        res.json({ success: true, children: result.rows });

    } catch (err) {
        // 3. Debug: Log the ACTUAL database error to your console
        console.error("❌ DATABASE ERROR:", err.message); 
        console.error("Full Error Object:", err);
        
        res.status(500).json({ 
            success: false, 
            message: "Error fetching stats",
            debug_error: err.message // sending this to frontend temporarily helps debugging
        });
    }
});

module.exports = router;