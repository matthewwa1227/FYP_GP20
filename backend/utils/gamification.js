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
 * Points Calculation Rules:
 * - Base: 1 point per minute
 * - Pomodoro Bonus: +10 points for 25+ minute sessions
 * - Deep Work Bonus: +20 points for 60+ minute sessions
 * - Marathon Bonus: +50 points for 120+ minute sessions
 */
function calculatePoints(durationMinutes) {
    let points = durationMinutes; // Base points
    
    // Bonus points for focused sessions
    if (durationMinutes >= 120) {
        points += 50;
    } else if (durationMinutes >= 60) {
        points += 20;
    } else if (durationMinutes >= 25) {
        points += 10;
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
 */
function generateSessionSummary(session, oldStats, newStats) {
    const xpGained = newStats.xp - oldStats.xp;
    const pointsGained = newStats.total_points - oldStats.total_points;
    const levelInfo = checkLevelUp(oldStats.xp, newStats.xp);
    const streakIncreased = newStats.current_streak > oldStats.current_streak;
    
    return {
        session: {
            duration: session.duration_minutes,
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
 */
function calculateSessionRewards(durationMinutes) {
    return {
        xp: calculateXP(durationMinutes),
        points: calculatePoints(durationMinutes),
        duration: durationMinutes
    };
}

/**
 * Get motivational message based on session duration
 */
function getMotivationalMessage(durationMinutes) {
    if (durationMinutes >= 120) {
        return {
            title: "🏆 Marathon Master!",
            message: "Incredible dedication! 2+ hours of focused study!",
            emoji: "🔥"
        };
    } else if (durationMinutes >= 60) {
        return {
            title: "💪 Deep Work Champion!",
            message: "Amazing focus! You crushed that hour!",
            emoji: "⭐"
        };
    } else if (durationMinutes >= 25) {
        return {
            title: "🍅 Pomodoro Pro!",
            message: "Perfect focus session! Keep it up!",
            emoji: "✨"
        };
    } else if (durationMinutes >= 10) {
        return {
            title: "👍 Good Start!",
            message: "Every minute counts! Keep building momentum!",
            emoji: "🎯"
        };
    } else {
        return {
            title: "🌱 Baby Steps!",
            message: "Great start! Try for 25 minutes next time!",
            emoji: "💚"
        };
    }
}

/**
 * Calculate daily goal progress
 */
function calculateDailyGoalProgress(todayMinutes, goalMinutes = 60) {
    const percentage = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
    const remaining = Math.max(0, goalMinutes - todayMinutes);
    
    return {
        completed: todayMinutes >= goalMinutes,
        percentage,
        minutesStudied: todayMinutes,
        minutesRemaining: remaining,
        goalMinutes
    };
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
    
    // Helpers
    isSameDay,
    isConsecutiveDay
};