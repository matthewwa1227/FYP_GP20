// ============================================
// StudyQuest - Gamification System
// FYP GP20 - XP, Levels, and Rewards
// ✅ UPDATED: 1 XP per 10 seconds, 10 second minimum
// ============================================

/**
 * XP Calculation Rules (UPDATED):
 * - Base: 1 XP per 10 seconds (6 XP per minute)
 * - 5 min Bonus: +5 XP for 300+ second sessions
 * - 15 min Bonus: +15 XP for 900+ second sessions
 * - Pomodoro Bonus: +50 XP for 1500+ second (25+ min) sessions
 * - Deep Work Bonus: +150 XP for 3600+ second (60+ min) sessions
 * - Marathon Bonus: +300 XP for 7200+ second (120+ min) sessions
 * 
 * @param {number} durationSeconds - Duration in SECONDS
 */
function calculateXP(durationSeconds) {
    // Base XP: 1 XP per 10 seconds
    let xp = Math.floor(durationSeconds / 10);
    
    // Bonus XP for focused sessions
    if (durationSeconds >= 7200) {        // 120+ minutes
        xp += 300; // Marathon session
    } else if (durationSeconds >= 3600) { // 60+ minutes
        xp += 150; // Deep work session
    } else if (durationSeconds >= 1500) { // 25+ minutes
        xp += 50;  // Pomodoro session
    } else if (durationSeconds >= 900) {  // 15+ minutes
        xp += 15;  // Good focus
    } else if (durationSeconds >= 300) {  // 5+ minutes
        xp += 5;   // Quick study
    }
    
    console.log(`💰 XP Calculation: ${durationSeconds}s (${Math.floor(durationSeconds/60)}m) → ${xp} XP`);
    
    return xp;
}

/**
 * Points Calculation Rules (UPDATED):
 * - Base: 1 point per 10 seconds
 * - 5 min Bonus: +2 points for 300+ second sessions
 * - 15 min Bonus: +5 points for 900+ second sessions
 * - Pomodoro Bonus: +10 points for 1500+ second (25+ min) sessions
 * - Deep Work Bonus: +20 points for 3600+ second (60+ min) sessions
 * - Marathon Bonus: +50 points for 7200+ second (120+ min) sessions
 * 
 * @param {number} durationSeconds - Duration in SECONDS
 */
function calculatePoints(durationSeconds) {
    // Base points: 1 point per 10 seconds
    let points = Math.floor(durationSeconds / 10);
    
    // Bonus points for focused sessions
    if (durationSeconds >= 7200) {        // 120+ minutes
        points += 50;
    } else if (durationSeconds >= 3600) { // 60+ minutes
        points += 20;
    } else if (durationSeconds >= 1500) { // 25+ minutes
        points += 10;
    } else if (durationSeconds >= 900) {  // 15+ minutes
        points += 5;
    } else if (durationSeconds >= 300) {  // 5+ minutes
        points += 2;
    }
    
    return points;
}

/**
 * Level Calculation:
 * Uses exponential growth formula to prevent early level grinding
 * Level 1-10: Easy progression (motivate beginners)
 * Level 10+: Harder progression (reward dedication)
 * 
 * Formula: XP Required = 100 * (level ^ 1.5)
 */
function calculateLevel(totalXP) {
    let level = 1;
    let xpForNextLevel = 100;
    
    while (totalXP >= xpForNextLevel) {
        level++;
        xpForNextLevel = Math.floor(100 * Math.pow(level, 1.5));
    }
    
    return level;
}

/**
 * Calculate XP needed for next level
 */
function getXPForNextLevel(currentLevel) {
    return Math.floor(100 * Math.pow(currentLevel + 1, 1.5));
}

/**
 * Calculate XP for current level (total XP needed to reach this level)
 */
function getXPForCurrentLevel(currentLevel) {
    if (currentLevel <= 1) return 0;
    return Math.floor(100 * Math.pow(currentLevel, 1.5));
}

/**
 * Calculate progress percentage to next level
 */
function getLevelProgress(currentXP, currentLevel) {
    const xpForCurrentLevel = getXPForCurrentLevel(currentLevel);
    const xpForNextLevel = getXPForNextLevel(currentLevel);
    const xpInCurrentLevel = currentXP - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    
    return {
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForLevel,
        percentage: Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForLevel) * 100))
    };
}

/**
 * Calculate study streak
 * Returns updated streak and whether it's at risk
 */
function calculateStreak(lastStudyDate, currentStreak) {
    if (!lastStudyDate) {
        return { streak: 1, isAtRisk: false, status: 'new' };
    }
    
    const now = new Date();
    const lastStudy = new Date(lastStudyDate);
    const hoursSinceLastStudy = (now - lastStudy) / (1000 * 60 * 60);
    
    // Same day - maintain streak
    if (isSameDay(now, lastStudy)) {
        return { 
            streak: currentStreak, 
            isAtRisk: false,
            status: 'maintained'
        };
    }
    
    // Consecutive day - increment streak
    if (isConsecutiveDay(now, lastStudy)) {
        return { 
            streak: currentStreak + 1, 
            isAtRisk: false,
            status: 'increased'
        };
    }
    
    // Streak at risk (studied yesterday but not today, still within 48 hours)
    if (hoursSinceLastStudy < 48) {
        return { 
            streak: currentStreak, 
            isAtRisk: true,
            status: 'at_risk',
            hoursRemaining: Math.floor(48 - hoursSinceLastStudy)
        };
    }
    
    // Streak broken - reset to 1
    return { 
        streak: 1, 
        isAtRisk: false,
        status: 'broken',
        previousStreak: currentStreak
    };
}

/**
 * Helper: Check if two dates are the same day
 */
function isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
}

/**
 * Helper: Check if date1 is the day after date2
 */
function isConsecutiveDay(date1, date2) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const date2Next = new Date(date2.getTime() + oneDayMs);
    return isSameDay(date1, date2Next);
}

/**
 * Calculate achievement progress
 * Returns array of achievement IDs that should be unlocked
 */
function checkAchievements(studentStats) {
    const achievements = [];
    
    // Session-based achievements
    if (studentStats.total_sessions === 1) achievements.push('first_session');
    if (studentStats.total_sessions === 5) achievements.push('early_bird');
    if (studentStats.total_sessions === 25) achievements.push('dedicated_learner');
    if (studentStats.total_sessions === 100) achievements.push('study_master');
    
    // Time-based achievements (in minutes)
    if (studentStats.total_study_time >= 60) achievements.push('hour_of_power');
    if (studentStats.total_study_time >= 600) achievements.push('marathon_runner');
    if (studentStats.total_study_time >= 3000) achievements.push('time_warrior');
    
    // Streak achievements
    if (studentStats.current_streak === 3) achievements.push('on_fire');
    if (studentStats.current_streak === 7) achievements.push('unstoppable');
    if (studentStats.current_streak === 30) achievements.push('legend');
    
    return achievements;
}

/**
 * Check if student unlocked a new level
 */
function checkLevelUp(oldXP, newXP) {
    const oldLevel = calculateLevel(oldXP);
    const newLevel = calculateLevel(newXP);
    
    return {
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
        levelsGained: newLevel - oldLevel
    };
}

/**
 * Generate session summary for frontend
 * @param {object} session - Session object with duration in seconds
 * @param {object} oldStats - Previous student stats
 * @param {object} newStats - Updated student stats
 */
function generateSessionSummary(session, oldStats, newStats) {
    const xpGained = newStats.xp - oldStats.xp;
    const pointsGained = (newStats.total_points || 0) - (oldStats.total_points || 0);
    const levelInfo = checkLevelUp(oldStats.xp, newStats.xp);
    const streakIncreased = newStats.current_streak > oldStats.current_streak;
    
    // Handle duration (could be in seconds or minutes depending on source)
    const durationSeconds = session.duration_seconds || session.duration || 0;
    const durationMinutes = session.duration_minutes || Math.floor(durationSeconds / 60);
    
    return {
        session: {
            durationSeconds: durationSeconds,
            durationMinutes: durationMinutes,
            durationFormatted: formatDuration(durationSeconds),
            subject: session.subject,
            topic: session.topic
        },
        rewards: {
            xpGained,
            pointsGained,
            leveledUp: levelInfo.leveledUp,
            newLevel: newStats.level,
            oldLevel: oldStats.level
        },
        progress: {
            streakIncreased,
            newStreak: newStats.current_streak,
            oldStreak: oldStats.current_streak,
            totalSessions: newStats.total_sessions,
            totalStudyTime: newStats.total_study_time
        },
        achievements: checkAchievements(newStats),
        levelProgress: getLevelProgress(newStats.xp, newStats.level)
    };
}

/**
 * Calculate session rewards (called when ending a session)
 * @param {number} durationSeconds - Duration in SECONDS
 */
function calculateSessionRewards(durationSeconds) {
    return {
        xp: calculateXP(durationSeconds),
        points: calculatePoints(durationSeconds),
        durationSeconds: durationSeconds,
        durationMinutes: Math.floor(durationSeconds / 60)
    };
}

/**
 * Get motivational message based on session duration
 * @param {number} durationSeconds - Duration in SECONDS
 */
function getMotivationalMessage(durationSeconds) {
    if (durationSeconds >= 7200) { // 120+ minutes
        return {
            title: "🏆 Marathon Master!",
            message: "Incredible dedication! 2+ hours of focused study!",
            emoji: "🔥"
        };
    } else if (durationSeconds >= 3600) { // 60+ minutes
        return {
            title: "💪 Deep Work Champion!",
            message: "Amazing focus! You crushed that hour!",
            emoji: "⭐"
        };
    } else if (durationSeconds >= 1500) { // 25+ minutes
        return {
            title: "🍅 Pomodoro Pro!",
            message: "Perfect focus session! Keep it up!",
            emoji: "✨"
        };
    } else if (durationSeconds >= 600) { // 10+ minutes
        return {
            title: "👍 Good Start!",
            message: "Every minute counts! Keep building momentum!",
            emoji: "🎯"
        };
    } else if (durationSeconds >= 60) { // 1+ minutes
        return {
            title: "🌱 Quick Study!",
            message: "Great start! Try for longer next time!",
            emoji: "💚"
        };
    } else { // Less than 1 minute
        return {
            title: "⚡ Speed Run!",
            message: "That was fast! Every second counts!",
            emoji: "⚡"
        };
    }
}

/**
 * Format duration from seconds to readable string
 * @param {number} seconds - Duration in seconds
 */
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds} sec`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
    }
}

/**
 * Calculate daily goal progress
 * @param {number} todaySeconds - Today's study time in SECONDS
 * @param {number} goalSeconds - Daily goal in SECONDS (default 1 hour = 3600 seconds)
 */
function calculateDailyGoalProgress(todaySeconds, goalSeconds = 3600) {
    const percentage = Math.min(100, Math.round((todaySeconds / goalSeconds) * 100));
    const remaining = Math.max(0, goalSeconds - todaySeconds);
    
    return {
        completed: todaySeconds >= goalSeconds,
        percentage,
        secondsStudied: todaySeconds,
        minutesStudied: Math.floor(todaySeconds / 60),
        secondsRemaining: remaining,
        minutesRemaining: Math.floor(remaining / 60),
        goalSeconds,
        goalMinutes: Math.floor(goalSeconds / 60)
    };
}

/**
 * Minimum session duration in seconds
 */
const MIN_SESSION_DURATION_SECONDS = 10;

/**
 * Check if session meets minimum duration requirement
 * @param {number} durationSeconds - Duration in seconds
 */
function isValidSessionDuration(durationSeconds) {
    return durationSeconds >= MIN_SESSION_DURATION_SECONDS;
}

/**
 * Get minimum duration error message
 */
function getMinDurationError() {
    return `Session too short. Please study for at least ${MIN_SESSION_DURATION_SECONDS} seconds.`;
}

module.exports = {
    // Core calculations
    calculateXP,
    calculatePoints,
    calculateLevel,
    getXPForNextLevel,
    getXPForCurrentLevel,
    getLevelProgress,
    
    // Streak system
    calculateStreak,
    
    // Achievements
    checkAchievements,
    checkLevelUp,
    
    // Session rewards
    calculateSessionRewards,
    generateSessionSummary,
    getMotivationalMessage,
    
    // Daily goals
    calculateDailyGoalProgress,
    
    // Duration helpers
    formatDuration,
    isValidSessionDuration,
    getMinDurationError,
    MIN_SESSION_DURATION_SECONDS,
    
    // Helpers
    isSameDay,
    isConsecutiveDay
};