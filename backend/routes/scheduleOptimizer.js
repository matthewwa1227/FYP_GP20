const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');

// ============================================
// GET /api/schedule-optimizer - Get student's optimized schedules
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    const result = await query(`
      SELECT *
      FROM optimized_schedules
      WHERE student_id = $1
      ORDER BY created_at DESC
    `, [studentId]);

    res.json({ success: true, schedules: result.rows });

  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, message: 'Failed to load schedules' });
  }
});

// ============================================
// POST /api/schedule-optimizer/generate - Generate optimized schedule
// ============================================
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { preferences, scheduleName } = req.body;

    // Get student's current data
    const studentResult = await query(`
      SELECT * FROM students WHERE id = $1
    `, [studentId]);

    const student = studentResult.rows[0];

    // Get recent study patterns
    const patternsResult = await query(`
      SELECT 
        EXTRACT(DOW FROM started_at) as day_of_week,
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as session_count,
        AVG(duration) as avg_duration
      FROM study_sessions
      WHERE student_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(DOW FROM started_at), EXTRACT(HOUR FROM started_at)
      ORDER BY day_of_week, hour
    `, [studentId]);

    // Get weak subjects
    const subjectsResult = await query(`
      SELECT 
        subject,
        AVG(CASE WHEN questions_answered > 0 
          THEN (correct_answers::DECIMAL / questions_answered) * 100 
          ELSE NULL END) as avg_accuracy,
        SUM(duration) as total_minutes
      FROM study_sessions
      WHERE student_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY subject
      ORDER BY avg_accuracy ASC NULLS LAST
    `, [studentId]);

    // Get existing goals
    const goalsResult = await query(`
      SELECT * FROM student_goals
      WHERE student_id = $1 AND status = 'active'
      ORDER BY end_date ASC
    `, [studentId]);

    // Generate optimized schedule using AI
    const prompt = `Create an optimized weekly study schedule for a student.

STUDENT PROFILE:
- Level: ${student.level}
- Current Streak: ${student.current_streak} days
- Age/Grade: ${student.form_level || 'Unknown'}
- Daily Time Limit: ${student.daily_time_limit_minutes || 25} minutes

STUDY PATTERNS (Last 30 days):
${patternsResult.rows.map(p => `- Day ${p.day_of_week}, Hour ${p.hour}: ${p.session_count} sessions, avg ${Math.round(p.avg_duration)} min`).join('\n')}

SUBJECT PERFORMANCE (Weakest first):
${subjectsResult.rows.map(s => `- ${s.subject}: ${s.avg_accuracy ? s.avg_accuracy.toFixed(1) : 'N/A'}% accuracy, ${Math.round(s.total_minutes / 60)} hours total`).join('\n')}

ACTIVE GOALS:
${goalsResult.rows.map(g => `- ${g.title}: ${g.target_metric} = ${g.target_value} (${g.progress_percentage}% complete)`).join('\n')}

PREFERENCES:
${JSON.stringify(preferences, null, 2)}

Generate a weekly schedule with:
1. Optimal study times based on their patterns
2. Priority to weak subjects
3. Time blocks for goal completion
4. Break recommendations
5. Reasoning for each choice

Return JSON format:
{
  "schedule_name": "name",
  "weekly_schedule": [
    {
      "day": "Monday",
      "slots": [
        {
          "start_time": "09:00",
          "end_time": "09:45",
          "subject": "Math",
          "activity": "Practice problems",
          "reasoning": "Focus on weak subject during peak hours"
        }
      ]
    }
  ],
  "reasoning": "overall explanation",
  "expected_outcomes": {
    "weekly_study_hours": 10,
    "improvement_areas": ["Math accuracy", "Reading speed"]
  }
}`;

    const aiResponse = await kimiService.sendMessageToKimi([
      { role: 'user', content: prompt }
    ], { maxTokens: 2000, useThinking: true });

    // Parse AI response
    let scheduleData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scheduleData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    if (!scheduleData) {
      return res.status(500).json({ success: false, message: 'Failed to generate schedule' });
    }

    // Save to database
    const result = await query(`
      INSERT INTO optimized_schedules (
        student_id, schedule_name, input_preferences,
        schedule_data, optimization_reasoning, expected_outcomes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      studentId,
      scheduleName || scheduleData.schedule_name || 'Optimized Schedule',
      JSON.stringify(preferences),
      JSON.stringify(scheduleData.weekly_schedule),
      scheduleData.reasoning,
      JSON.stringify(scheduleData.expected_outcomes)
    ]);

    res.json({
      success: true,
      schedule: result.rows[0],
      generated: scheduleData
    });

  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate schedule' });
  }
});

// ============================================
// PUT /api/schedule-optimizer/:id/accept - Accept a schedule
// ============================================
router.put('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const scheduleId = req.params.id;

    // Deactivate current schedule
    await query(`
      UPDATE optimized_schedules
      SET is_active = FALSE
      WHERE student_id = $1
    `, [studentId]);

    // Activate new schedule
    const result = await query(`
      UPDATE optimized_schedules
      SET is_accepted = TRUE, accepted_at = CURRENT_TIMESTAMP, is_active = TRUE
      WHERE id = $1 AND student_id = $2
      RETURNING *
    `, [scheduleId, studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });

  } catch (error) {
    console.error('Accept schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept schedule' });
  }
});

// ============================================
// POST /api/schedule-optimizer/:id/track - Track adherence to schedule
// ============================================
router.post('/:id/track', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const scheduleId = req.params.id;
    const { plannedDate, plannedSlot, sessionId, followed, deviationReason } = req.body;

    const result = await query(`
      INSERT INTO schedule_adherence (
        schedule_id, student_id, planned_date, planned_slot,
        actual_session_id, followed, deviation_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [scheduleId, studentId, plannedDate, JSON.stringify(plannedSlot), sessionId, followed, deviationReason]);

    // Update adherence rate
    await query(`
      UPDATE optimized_schedules
      SET adherence_rate = (
        SELECT (COUNT(*) FILTER (WHERE followed = TRUE) * 100.0 / NULLIF(COUNT(*), 0))
        FROM schedule_adherence
        WHERE schedule_id = $1
      )
      WHERE id = $1
    `, [scheduleId]);

    res.json({ success: true, tracking: result.rows[0] });

  } catch (error) {
    console.error('Track adherence error:', error);
    res.status(500).json({ success: false, message: 'Failed to track adherence' });
  }
});

// ============================================
// GET /api/schedule-optimizer/:id/adherence - Get adherence stats
// ============================================
router.get('/:id/adherence', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const scheduleId = req.params.id;

    const result = await query(`
      SELECT 
        planned_date,
        followed,
        deviation_reason,
        ss.subject, ss.duration
      FROM schedule_adherence sa
      LEFT JOIN study_sessions ss ON sa.actual_session_id = ss.id
      WHERE sa.schedule_id = $1 AND sa.student_id = $2
      ORDER BY sa.planned_date DESC
    `, [scheduleId, studentId]);

    const stats = await query(`
      SELECT 
        COUNT(*) as total_slots,
        COUNT(*) FILTER (WHERE followed = TRUE) as followed_count,
        COUNT(*) FILTER (WHERE followed = FALSE) as missed_count,
        (COUNT(*) FILTER (WHERE followed = TRUE) * 100.0 / NULLIF(COUNT(*), 0)) as adherence_rate
      FROM schedule_adherence
      WHERE schedule_id = $1
    `, [scheduleId]);

    res.json({
      success: true,
      adherence: result.rows,
      stats: stats.rows[0]
    });

  } catch (error) {
    console.error('Get adherence error:', error);
    res.status(500).json({ success: false, message: 'Failed to load adherence' });
  }
});

// ============================================
// DELETE /api/schedule-optimizer/:id - Delete schedule
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const scheduleId = req.params.id;

    await query(`
      DELETE FROM optimized_schedules
      WHERE id = $1 AND student_id = $2
    `, [scheduleId, studentId]);

    res.json({ success: true, message: 'Schedule deleted' });

  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete schedule' });
  }
});

module.exports = router;
