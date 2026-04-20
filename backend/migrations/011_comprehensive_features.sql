
-- Student goals table
CREATE TABLE IF NOT EXISTS student_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Goal Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'subject', 'skill'
    target_metric VARCHAR(50) NOT NULL, -- 'minutes', 'sessions', 'xp', 'streak', 'accuracy'
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    
    -- Subject/Topic specific (optional)
    subject VARCHAR(100),
    topic VARCHAR(255),
    
    -- Timeframe
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    progress_percentage INTEGER DEFAULT 0,
    
    -- Reward
    reward_xp INTEGER DEFAULT 0,
    reward_badge VARCHAR(100),
    
    -- Parent/Teacher involvement
    created_by UUID,
    is_approved BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_student_goals_student ON student_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_goals_status ON student_goals(status);
CREATE INDEX IF NOT EXISTS idx_student_goals_type ON student_goals(goal_type);

-- Progress tracking table (detailed daily/weekly progress)
CREATE TABLE IF NOT EXISTS progress_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Time period
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tracking_week INTEGER, -- ISO week number
    tracking_month INTEGER,
    tracking_year INTEGER,
    
    -- Study metrics
    total_minutes INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2),
    
    -- Subject breakdown (JSON)
    subject_breakdown JSONB DEFAULT '{}',
    
    -- Skill progression
    skills_improved JSONB DEFAULT '[]',
    
    -- Comparisons
    vs_last_week DECIMAL(5,2),
    vs_average DECIMAL(5,2),
    
    UNIQUE(student_id, tracking_date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_tracking_student_date ON progress_tracking(student_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_week ON progress_tracking(tracking_year, tracking_week);



-- Reward definitions (created by parents/teachers)
CREATE TABLE IF NOT EXISTS reward_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL,
    creator_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher', 'self'
    
    -- Reward Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) NOT NULL, -- 'digital_badge', 'real_reward', 'privilege', 'activity'
    
    -- Requirements to unlock
    requirement_type VARCHAR(50), -- 'goal_completion', 'streak', 'xp_threshold', 'custom'
    requirement_value INTEGER,
    requirement_description TEXT,
    
    -- Visual
    icon VARCHAR(10) DEFAULT '🎁',
    color VARCHAR(20) DEFAULT 'gold',
    
    -- For real rewards
    reward_value VARCHAR(100), -- e.g., "$50", "Movie night"
    delivery_method TEXT, -- How to deliver the reward
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES students(id) ON DELETE CASCADE
);

-- Student rewards (earned/unlocked)
CREATE TABLE IF NOT EXISTS student_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    reward_id UUID,
    
    -- Reward copy (in case definition changes)
    reward_title VARCHAR(255),
    reward_description TEXT,
    reward_type VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'locked', -- 'locked', 'unlocked', 'claimed', 'delivered'
    progress_percentage INTEGER DEFAULT 0,
    
    -- Unlock details
    unlocked_at TIMESTAMP WITH TIME ZONE,
    unlocked_by_goal UUID,
    
    -- Claim details
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by UUID, -- Parent who approved
    claim_notes TEXT,
    
    -- Delivery tracking (for real rewards)
    delivery_status VARCHAR(20), -- 'pending', 'shipped', 'delivered', 'redeemed'
    delivery_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES reward_definitions(id) ON DELETE SET NULL,
    FOREIGN KEY (claimed_by) REFERENCES students(id),
    FOREIGN KEY (unlocked_by_goal) REFERENCES student_goals(id)
);

CREATE INDEX IF NOT EXISTS idx_student_rewards_student ON student_rewards(student_id);
CREATE INDEX IF NOT EXISTS idx_student_rewards_status ON student_rewards(status);

-- Reward collaborations (parents and teachers collaborating)
CREATE TABLE IF NOT EXISTS reward_collaborations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reward_id UUID NOT NULL,
    collaborator_id UUID NOT NULL,
    collaborator_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher'
    
    -- Permissions
    can_edit BOOLEAN DEFAULT FALSE,
    can_approve_claims BOOLEAN DEFAULT TRUE,
    can_view_progress BOOLEAN DEFAULT TRUE,
    
    -- Notification preferences
    notify_on_unlock BOOLEAN DEFAULT TRUE,
    notify_on_claim BOOLEAN DEFAULT TRUE,
    
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(reward_id, collaborator_id),
    FOREIGN KEY (reward_id) REFERENCES reward_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (collaborator_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 3. AI CONVERSATION REVIEW
-- ============================================

-- AI conversation history (for parents/teachers to review)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Conversation metadata
    session_id VARCHAR(100), -- Group messages by session
    conversation_type VARCHAR(50) DEFAULT 'study_buddy', -- 'study_buddy', 'tutor', 'story_quest'
    
    -- Message content
    message_role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    message_content TEXT NOT NULL,
    message_metadata JSONB DEFAULT '{}', -- Contains thinking, citations, etc.
    
    -- Context at time of conversation
    student_context JSONB DEFAULT '{}', -- { level, xp, streak, subject }
    
    -- Review status
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_student ON ai_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_type ON ai_conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_flagged ON ai_conversations(is_flagged) WHERE is_flagged = TRUE;

-- Conversation review permissions
CREATE TABLE IF NOT EXISTS conversation_reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewer_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher'
    
    -- Permissions
    can_view_all BOOLEAN DEFAULT TRUE,
    can_flag_conversations BOOLEAN DEFAULT TRUE,
    can_add_notes BOOLEAN DEFAULT TRUE,
    receive_alerts BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, reviewer_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 4. TEACHER MODULE - CLASS MANAGEMENT
-- ============================================

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL,
    
    -- Class Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    grade_level VARCHAR(20),
    
    -- Settings
    class_code VARCHAR(20) UNIQUE, -- For students to join
    is_active BOOLEAN DEFAULT TRUE,
    max_students INTEGER DEFAULT 30,
    
    -- Schedule
    start_date DATE,
    end_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (teacher_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code);

-- Class students (junction table)
CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'removed'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance tracking
    overall_grade VARCHAR(5),
    attendance_rate DECIMAL(5,2),
    
    UNIQUE(class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- Class challenges
CREATE TABLE IF NOT EXISTS class_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    created_by UUID NOT NULL,
    
    -- Challenge Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50), -- 'study_time', 'accuracy', 'streak', 'completion'
    
    -- Requirements
    target_metric VARCHAR(50),
    target_value INTEGER,
    time_limit_hours INTEGER, -- 0 for no limit
    
    -- Rewards
    xp_reward INTEGER DEFAULT 0,
    badge_reward VARCHAR(100),
    
    -- Status
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    
    -- Results
    winner_id UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id),
    FOREIGN KEY (winner_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_class_challenges_class ON class_challenges(class_id);
CREATE INDEX IF NOT EXISTS idx_class_challenges_status ON class_challenges(status);

-- Challenge participants progress
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Progress
    current_value INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    rank INTEGER,
    
    -- Status
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(challenge_id, student_id),
    FOREIGN KEY (challenge_id) REFERENCES class_challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 5. STUDENT ANALYTICS FOR TEACHERS
-- ============================================

-- Aggregated analytics view (materialized view would be better for performance)
CREATE TABLE IF NOT EXISTS student_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    class_id UUID,
    
    -- Time period
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    
    -- Study metrics
    total_study_minutes INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    
    -- Performance metrics
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2),
    
    -- Engagement
    login_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    -- Skill breakdown
    strong_skills JSONB DEFAULT '[]',
    weak_skills JSONB DEFAULT '[]',
    skill_progression JSONB DEFAULT '{}',
    
    -- Comparisons
    class_rank INTEGER,
    class_average_comparison DECIMAL(5,2), -- percentage above/below average
    
    -- AI Tutor usage
    ai_conversations_count INTEGER DEFAULT 0,
    avg_conversation_length INTEGER DEFAULT 0,
    
    -- Flags for teacher attention
    needs_attention BOOLEAN DEFAULT FALSE,
    attention_reasons JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, teacher_id, analytics_date, period_type),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_student_analytics_student ON student_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_teacher ON student_analytics(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_class ON student_analytics(class_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_attention ON student_analytics(needs_attention) WHERE needs_attention = TRUE;

-- ============================================
-- 6. SESSION VERIFICATION
-- ============================================

-- Session verification (for teachers to verify study sessions)
CREATE TABLE IF NOT EXISTS session_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Verification status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'auto_verified'
    
    -- Verification methods
    verified_by UUID, -- Teacher/parent who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50), -- 'manual', 'auto_ai', 'parent_confirm', 'peer_confirm'
    
    -- Evidence
    screenshot_url TEXT,
    notes TEXT,
    ai_confidence_score DECIMAL(5,2), -- AI analysis confidence
    
    -- Rejection details
    rejection_reason TEXT,
    rejected_by UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES students(id),
    FOREIGN KEY (rejected_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_session_verifications_session ON session_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_session_verifications_status ON session_verifications(status);
CREATE INDEX IF NOT EXISTS idx_session_verifications_student ON session_verifications(student_id);

-- ============================================
-- 7. STUDY GROUPS
-- ============================================

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Settings
    is_private BOOLEAN DEFAULT FALSE,
    join_code VARCHAR(20) UNIQUE,
    max_members INTEGER DEFAULT 10,
    
    -- Focus
    subject VARCHAR(100),
    topics JSONB DEFAULT '[]',
    
    -- Created by
    creator_id UUID NOT NULL,
    
    -- Stats
    total_study_minutes INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creator_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_groups_creator ON study_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_subject ON study_groups(subject);

-- Group members
CREATE TABLE IF NOT EXISTS study_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Role
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member', 'moderator'
    
    -- Stats
    contribution_minutes INTEGER DEFAULT 0,
    contribution_sessions INTEGER DEFAULT 0,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(group_id, student_id),
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_group_members_group ON study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_student ON study_group_members(student_id);

-- Group study sessions
CREATE TABLE IF NOT EXISTS group_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL,
    created_by UUID NOT NULL,
    
    -- Session details
    title VARCHAR(255),
    description TEXT,
    subject VARCHAR(100),
    
    -- Schedule
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
    
    -- Participants
    participant_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id)
);

-- Group session participants
CREATE TABLE IF NOT EXISTS group_session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    study_minutes INTEGER DEFAULT 0,
    
    UNIQUE(session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES group_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 8. FRIENDS SYSTEM
-- ============================================

-- Friend connections
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL,
    addressee_id UUID NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked', 'declined'
    
    -- Stats
    shared_study_minutes INTEGER DEFAULT 0,
    shared_sessions INTEGER DEFAULT 0,
    
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(requester_id, addressee_id),
    FOREIGN KEY (requester_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Friend activity feed
CREATE TABLE IF NOT EXISTS friend_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- 'session_complete', 'goal_achieved', 'level_up', 'badge_earned', 'challenge_won'
    activity_data JSONB DEFAULT '{}',
    
    -- Visibility
    is_public BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friend_activities_student ON friend_activities(student_id);
CREATE INDEX IF NOT EXISTS idx_friend_activities_created ON friend_activities(created_at);

-- ============================================
-- 9. CHALLENGES SYSTEM
-- ============================================

-- Challenges (global and personal)
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Creator (NULL for system challenges)
    created_by UUID,
    creator_type VARCHAR(20) DEFAULT 'system', -- 'system', 'teacher', 'parent', 'student'
    
    -- Challenge details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL, -- 'personal', 'friend', 'group', 'class', 'global'
    category VARCHAR(50), -- 'study_time', 'accuracy', 'streak', 'completion', 'speed'
    
    -- Requirements
    target_metric VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    time_limit_days INTEGER, -- NULL for no limit
    
    -- Difficulty
    difficulty VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard', 'expert'
    
    -- Rewards
    xp_reward INTEGER DEFAULT 0,
    badge_id UUID,
    
    -- Availability
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Scope
    class_id UUID,
    group_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);

-- Challenge participants
CREATE TABLE IF NOT EXISTS challenge_participants_all (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Progress
    current_value INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    rank INTEGER,
    
    -- Status
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    reward_claimed_at TIMESTAMP WITH TIME ZONE,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(challenge_id, student_id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 10. SCHEDULE OPTIMIZER
-- ============================================

-- Optimal study schedules (AI-generated)
CREATE TABLE IF NOT EXISTS optimized_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Schedule details
    schedule_name VARCHAR(255) DEFAULT 'Optimized Schedule',
    generated_by VARCHAR(50) DEFAULT 'ai', -- 'ai', 'teacher', 'self'
    
    -- Input parameters
    input_preferences JSONB DEFAULT '{}', -- { preferred_times, subjects_focus, goals }
    
    -- The optimized schedule
    schedule_data JSONB NOT NULL, -- Array of { day, time_slots: [{ start, end, subject, activity, reason }] }
    
    -- AI explanation
    optimization_reasoning TEXT,
    expected_outcomes JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_accepted BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance tracking
    adherence_rate DECIMAL(5,2),
    effectiveness_score DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Schedule adherence tracking
CREATE TABLE IF NOT EXISTS schedule_adherence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Planned vs Actual
    planned_date DATE NOT NULL,
    planned_slot JSONB NOT NULL,
    actual_session_id UUID,
    
    -- Adherence
    followed BOOLEAN DEFAULT FALSE,
    deviation_minutes INTEGER DEFAULT 0,
    deviation_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (schedule_id) REFERENCES optimized_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (actual_session_id) REFERENCES study_sessions(id) ON DELETE SET NULL
);

-- ============================================
-- 11. TEACHER ANALYTICS DASHBOARD
-- ============================================

-- Class overview analytics
CREATE TABLE IF NOT EXISTS class_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    
    -- Time period
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    
    -- Class metrics
    total_students INTEGER DEFAULT 0,
    active_students INTEGER DEFAULT 0, -- Students who studied today
    
    -- Aggregate study metrics
    total_study_minutes INTEGER DEFAULT 0,
    avg_study_minutes_per_student INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    
    -- Performance
    avg_accuracy_rate DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    
    -- Engagement
    avg_session_duration INTEGER DEFAULT 0,
    most_active_hour INTEGER,
    
    -- Subject breakdown
    subject_breakdown JSONB DEFAULT '{}',
    
    -- Top performers & needs attention
    top_performers JSONB DEFAULT '[]',
    needs_attention JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_student_goals_updated_at ON student_goals;
CREATE TRIGGER update_student_goals_updated_at 
    BEFORE UPDATE ON student_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at 
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_groups_updated_at ON study_groups;
CREATE TRIGGER update_study_groups_updated_at 
    BEFORE UPDATE ON study_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_optimized_schedules_updated_at ON optimized_schedules;
CREATE TRIGGER update_optimized_schedules_updated_at 
    BEFORE UPDATE ON optimized_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, points_reward, badge_tier) VALUES
-- Social achievements
('Social Scholar', 'Join your first study group', '👥', 'social', 'study_groups_joined', 1, 50, 'bronze'),
('Group Leader', 'Create a study group', '👑', 'social', 'study_groups_created', 1, 100, 'bronze'),
('Team Player', 'Study 10 hours in group sessions', '🤝', 'social', 'group_study_minutes', 600, 200, 'silver'),
('Popular Student', 'Make 5 friends', '❤️', 'social', 'friends_count', 5, 100, 'bronze'),

-- Challenge achievements
('Challenge Accepted', 'Complete your first challenge', '🎯', 'challenges', 'challenges_completed', 1, 50, 'bronze'),
('Challenge Champion', 'Complete 10 challenges', '🏆', 'challenges', 'challenges_completed', 10, 300, 'silver'),
('Speed Demon', 'Complete a speed challenge', '⚡', 'challenges', 'speed_challenges', 1, 100, 'bronze'),

-- Goal achievements
('Goal Setter', 'Create your first goal', '📝', 'goals', 'goals_created', 1, 25, 'bronze'),
('Goal Crusher', 'Complete 5 goals', '✅', 'goals', 'goals_completed', 5, 150, 'silver'),
('Overachiever', 'Exceed a goal by 50%', '🚀', 'goals', 'goals_exceeded', 1, 200, 'silver'),

-- Teacher/Class achievements
('Class Champion', 'Rank #1 in your class', '🥇', 'class', 'class_rank', 1, 300, 'gold'),
('Teacher''s Pet', 'Be verified by teacher 10 times', '✔️', 'class', 'teacher_verifications', 10, 100, 'bronze'),
('Study Star', 'Be in top 3 of class for a week', '⭐', 'class', 'top_three_week', 1, 200, 'silver'),

-- Schedule achievements
('Schedule Master', 'Follow optimized schedule for 7 days', '📅', 'schedule', 'schedule_adherence', 7, 150, 'bronze'),
('Consistency King', '30 days of schedule adherence', '📆', 'schedule', 'schedule_adherence', 30, 500, 'gold')
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 'Comprehensive features migration completed successfully! 🎓✨' as message;
