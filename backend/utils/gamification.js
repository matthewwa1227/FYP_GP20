// ============================================
// StudyQuest - Gamification System
// FYP GP20 - XP, Levels, and Rewards
// ============================================

/**
 * XP Calculation Rules:
 * - Base: 10 XP per minute studied
 * - Pomodoro Bonus: +50 XP for 25+ minute sessions
 * - Deep Work Bonus: +150 XP for 60+ minute sessions
 * - Marathon Bonus: +300 XP for 120+ minute sessions
 */
function calculateXP(durationMinutes) {
    let xp = durationMinutes * 10; // Base XP
    
    // Bonus XP for focused sessions
    if (durationMinutes >= 120) {
        xp += 300; // Marathon session
    } else if (durationMinutes >= 60) {
        xp += 150; // Deep work session
    } else if (durationMinutes >= 25) {
        xp += 50; // Pomodoro session
    }
    
    return xp;
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
 * Calculate progress percentage to next level
 */
function getLevelProgress(currentXP, currentLevel) {
    const xpForCurrentLevel = currentLevel === 1 ? 0 : Math.floor(100 * Math.pow(currentLevel, 1.5));
    const xpForNextLevel = getXPForNextLevel(currentLevel);
    const xpInCurrentLevel = currentXP - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    
    return {
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForLevel,
        percentage: Math.floor((xpInCurrentLevel / xpNeededForLevel) * 100)
    };
}

/**
 * Calculate study streak
 * Returns updated streak and whether it's at risk
 */
function calculateStreak(lastStudyDate, currentStreak) {
    if (!lastStudyDate) {
        return { streak: 1, isAtRisk: false };
    }
    
    const now = new Date();
    const lastStudy = new Date(lastStudyDate);
    const hoursSinceLastStudy = (now - lastStudy) / (1000 * 60 * 60);
    
    // Same day - maintain streak
    if (isSameDay(now, lastStudy)) {
        return { streak: currentStreak, isAtRisk: false };
    }
    
    // Consecutive day - increment streak
    if (isConsecutiveDay(now, lastStudy)) {
        return { streak: currentStreak + 1, isAtRisk: false };
    }
    
    // Streak at risk (studied yesterday but not today)
    if (hoursSinceLastStudy < 48) {
        return { streak: currentStreak, isAtRisk: true };
    }
    
    // Streak broken - reset to 1
    return { streak: 1, isAtRisk: false };
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
 * Checks if user unlocked any achievements
 */
function checkAchievements(studentStats) {
    const achievements = [];
    
    // Session-based achievements
    if (studentStats.total_sessions === 1) achievements.push('first_session');
    if (studentStats.total_sessions === 5) achievements.push('early_bird');
    if (studentStats.total_sessions === 25) achievements.push('dedicated_learner');
    if (studentStats.total_sessions === 100) achievements.push('study_master');
    
    // Time-based achievements
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
 * Generate session summary for frontend
 */
function generateSessionSummary(session, oldStats, newStats) {
    const xpGained = newStats.xp - oldStats.xp;
    const leveledUp = newStats.level > oldStats.level;
    const streakIncreased = newStats.current_streak > oldStats.current_streak;
    
    return {
        duration: session.duration_minutes,
        xpGained,
        leveledUp,
        newLevel: newStats.level,
        streakIncreased,
        newStreak: newStats.current_streak,
        achievements: checkAchievements(newStats)
    };
}

module.exports = {
    calculateXP,
    calculateLevel,
    getXPForNextLevel,
    getLevelProgress,
    calculateStreak,
    checkAchievements,
    generateSessionSummary
};