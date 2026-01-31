const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// Get all tasks for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM tasks 
       WHERE user_id = $1 
       ORDER BY 
         CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
         CASE 
           WHEN priority::text = 'high' THEN 1 
           WHEN priority::text = 'medium' THEN 2 
           WHEN priority::text = 'low' THEN 3 
           ELSE 2
         END,
         due_date ASC NULLS LAST,
         created_at DESC`,
      [req.user.id]
    );
    
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Get tasks summary (for dashboard) - MUST be before /:id route
router.get('/summary/stats', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue,
         COUNT(*) as total
       FROM tasks 
       WHERE user_id = $1`,
      [req.user.id]
    );
    
    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error('Get tasks summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single task
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, priority, dueDate, estimatedMinutes } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    const result = await db.query(
      `INSERT INTO tasks (user_id, title, description, subject, priority, due_date, estimated_minutes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        req.user.id,
        title.trim(),
        description || '',
        subject || 'General',
        priority || 'medium',
        dueDate || null,
        estimatedMinutes || 30
      ]
    );
    
    res.status(201).json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, priority, dueDate, estimatedMinutes, status } = req.body;
    
    // First check if task exists and belongs to user
    const existing = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const task = existing.rows[0];
    
    // Determine completed_at
    let completedAt = task.completed_at;
    if (status === 'completed' && task.status !== 'completed') {
      completedAt = new Date();
    } else if (status !== 'completed') {
      completedAt = null;
    }
    
    const result = await db.query(
      `UPDATE tasks 
       SET title = $1, 
           description = $2, 
           subject = $3, 
           priority = $4, 
           due_date = $5, 
           estimated_minutes = $6, 
           status = $7,
           completed_at = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        title !== undefined ? title : task.title,
        description !== undefined ? description : task.description,
        subject !== undefined ? subject : task.subject,
        priority !== undefined ? priority : task.priority,
        dueDate !== undefined ? dueDate : task.due_date,
        estimatedMinutes !== undefined ? estimatedMinutes : task.estimated_minutes,
        status !== undefined ? status : task.status,
        completedAt,
        req.params.id,
        req.user.id
      ]
    );
    
    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle task completion
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const task = existing.rows[0];
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date() : null;
    
    const result = await db.query(
      `UPDATE tasks 
       SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [newStatus, completedAt, req.params.id, req.user.id]
    );
    
    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Toggle task error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

