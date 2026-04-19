/**
 * STUDYQUEST REBUILD - API ROUTES
 * Phase 2: API Layer
 * 
 * Endpoints:
 * - POST /api/projects - Create new project
 * - POST /api/chapters/generate - Generate single chapter
 * - POST /api/attempts - Submit answer + get AI diagnosis
 * - POST /api/boss-battles - Initialize/progress boss battles
 * - GET /api/artifacts - Retrieve user's knowledge artifacts
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const kimiService = require('../services/kimiService');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Set user context for RLS policies
 */
const setUserContext = async (userId) => {
    await db.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId]);
};

/**
 * Generate unique ID
 */
const generateId = () => {
    return require('crypto').randomUUID();
};

// ============================================
// 1. PROJECTS
// ============================================

/**
 * POST /api/projects
 * Create a new learning project
 * 
 * Body: { topic: string, goal?: string }
 * Returns: { project, firstChapter }
 */
router.post('/projects', authenticateToken, async (req, res) => {
    const { topic, goal } = req.body;
    const userId = req.user.id;

    if (!topic || topic.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Topic is required'
        });
    }

    try {
        await setUserContext(userId);

        // Get user tier info for age-appropriate content
        const userResult = await db.query(
            `SELECT age_tier, form_level FROM students WHERE id = $1`,
            [userId]
        );
        const dbTier = userResult.rows[0] || {};
        const tierInfo = {
            ageTier: dbTier.age_tier || null,
            formLevel: dbTier.form_level || null
        };

        // 1. Generate project scope with AI
        console.log(`🎯 Generating project scope for: ${topic}`);
        const scope = await kimiService.generateProjectScope(topic, goal, tierInfo, topic);

        // 2. Create project record
        const projectResult = await db.query(`
            INSERT INTO projects (id, user_id, title, description, deliverable, topic, skill_tree, total_chapters)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            generateId(),
            userId,
            scope.title,
            scope.description,
            scope.deliverable,
            topic,
            JSON.stringify(scope.skillTree),
            scope.skillTree.filter(n => !n.isBoss).length
        ]);

        const project = projectResult.rows[0];

        // 3. Generate first chapter immediately
        console.log(`📖 Generating Chapter 1...`);
        const firstSkill = scope.skillTree.find(n => n.prerequisites.length === 0);
        
        const chapterContent = await kimiService.generateChapter({
            topic,
            chapterNumber: 1,
            skillName: firstSkill.name,
            projectContext: scope.description,
            deliverable: scope.deliverable,
            tierInfo,
            subject: topic
        });

        // 4. Create chapter record
        const chapterResult = await db.query(`
            INSERT INTO chapters (
                id, project_id, chapter_number, title, focus_area, 
                context, content, status, estimated_minutes, difficulty_level
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            generateId(),
            project.id,
            1,
            firstSkill.name,
            chapterContent.focus,
            chapterContent.context,
            JSON.stringify({
                keyPoints: chapterContent.keyPoints,
                fullLesson: chapterContent.fullLesson,
                whyItMatters: chapterContent.whyItMatters
            }),
            'available',
            firstSkill.estimatedMinutes || 20,
            1
        ]);

        const chapter = chapterResult.rows[0];

        // 5. Generate questions for the chapter
        console.log(`❓ Generating questions for Chapter 1...`);
        const questions = await kimiService.generateQuestions({
            topic,
            chapterTitle: firstSkill.name,
            lessonContent: chapterContent.fullLesson,
            count: 3
        });

        // 6. Insert questions
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await db.query(`
                INSERT INTO questions (
                    id, chapter_id, question_type, question_data, 
                    correct_answer, ai_explanation, hint, order_index
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                generateId(),
                chapter.id,
                q.type,
                JSON.stringify(q.data),
                JSON.stringify(q.correctAnswer),
                q.explanation,
                q.hint,
                i
            ]);
        }

        // Update chapter question count
        await db.query(`
            UPDATE chapters SET question_count = $1 WHERE id = $2
        `, [questions.length, chapter.id]);

        res.json({
            success: true,
            project: {
                ...project,
                skillTree: scope.skillTree
            },
            firstChapter: {
                ...chapter,
                content: {
                    keyPoints: chapterContent.keyPoints,
                    fullLesson: chapterContent.fullLesson,
                    whyItMatters: chapterContent.whyItMatters
                }
            },
            message: 'Project created successfully! Chapter 1 is ready to start.'
        });

    } catch (error) {
        console.error('❌ Project creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/projects/:id
 * Get project with all chapters
 */
router.get('/projects/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Get project
        const projectResult = await db.query(`
            SELECT * FROM projects WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const project = projectResult.rows[0];

        // Get all chapters
        const chaptersResult = await db.query(`
            SELECT * FROM chapters 
            WHERE project_id = $1 
            ORDER BY chapter_number ASC
        `, [id]);

        res.json({
            success: true,
            project: {
                ...project,
                skillTree: project.skill_tree
            },
            chapters: chaptersResult.rows
        });

    } catch (error) {
        console.error('❌ Get project error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get project'
        });
    }
});

// ============================================
// 2. CHAPTERS
// ============================================

/**
 * POST /api/chapters/generate
 * Generate next chapter on-demand
 * 
 * Body: { projectId: string, previousChapterId?: string, userChoice?: string }
 */
router.post('/chapters/generate', authenticateToken, async (req, res) => {
    const { projectId, previousChapterId, userChoice } = req.body;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Get user tier info for age-appropriate content
        const userResult = await db.query(
            `SELECT age_tier, form_level FROM students WHERE id = $1`,
            [userId]
        );
        const dbTier = userResult.rows[0] || {};
        const tierInfo = {
            ageTier: dbTier.age_tier || null,
            formLevel: dbTier.form_level || null
        };

        // Get project info
        const projectResult = await db.query(`
            SELECT * FROM projects WHERE id = $1 AND user_id = $2
        `, [projectId, userId]);

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const project = projectResult.rows[0];

        // Determine next chapter based on skill tree
        const skillTree = project.skill_tree;
        const completedChapters = await db.query(`
            SELECT chapter_number FROM chapters 
            WHERE project_id = $1 AND status = 'completed'
        `, [projectId]);

        const completedNumbers = completedChapters.rows.map(r => r.chapter_number);
        
        // Find available skills (prerequisites met)
        const availableSkills = skillTree.filter(skill => {
            if (skill.isBoss) return false; // Boss is separate
            const prereqsMet = skill.prerequisites.every(p => 
                completedNumbers.includes(parseInt(p))
            );
            const notCompleted = !completedNumbers.includes(parseInt(skill.id));
            return prereqsMet && notCompleted;
        });

        if (availableSkills.length === 0) {
            // All regular chapters done, unlock boss if confidence is high enough
            return res.json({
                success: true,
                bossUnlocked: true,
                message: 'All chapters completed! Boss battle is now available.',
                confidenceScore: project.confidence_score
            });
        }

        // Select next skill (could be AI-recommended or user choice)
        const nextSkill = availableSkills[0]; // Simplified: take first available
        const nextChapterNumber = completedNumbers.length + 1;

        // Generate chapter content
        console.log(`📖 Generating Chapter ${nextChapterNumber}: ${nextSkill.name}`);
        
        const chapterContent = await kimiService.generateChapter({
            topic: project.topic,
            chapterNumber: nextChapterNumber,
            skillName: nextSkill.name,
            projectContext: project.description,
            deliverable: project.deliverable,
            previousContext: previousChapterId ? await getChapterContext(previousChapterId) : null,
            tierInfo,
            subject: project.topic
        });

        // Create chapter record
        const chapterResult = await db.query(`
            INSERT INTO chapters (
                id, project_id, chapter_number, title, focus_area, 
                context, content, status, estimated_minutes, difficulty_level
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            generateId(),
            projectId,
            nextChapterNumber,
            nextSkill.name,
            chapterContent.focus,
            chapterContent.context,
            JSON.stringify({
                keyPoints: chapterContent.keyPoints,
                fullLesson: chapterContent.fullLesson,
                whyItMatters: chapterContent.whyItMatters
            }),
            'available',
            nextSkill.estimatedMinutes || 20,
            Math.min(5, Math.floor(nextChapterNumber / 2) + 1)
        ]);

        const chapter = chapterResult.rows[0];

        // Generate questions
        const questions = await kimiService.generateQuestions({
            topic: project.topic,
            chapterTitle: nextSkill.name,
            lessonContent: chapterContent.fullLesson,
            count: 3
        });

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await db.query(`
                INSERT INTO questions (
                    id, chapter_id, question_type, question_data, 
                    correct_answer, ai_explanation, hint, order_index
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                generateId(),
                chapter.id,
                q.type,
                JSON.stringify(q.data),
                JSON.stringify(q.correctAnswer),
                q.explanation,
                q.hint,
                i
            ]);
        }

        await db.query(`
            UPDATE chapters SET question_count = $1 WHERE id = $2
        `, [questions.length, chapter.id]);

        // Update project current chapter
        await db.query(`
            UPDATE projects SET current_chapter = $1, updated_at = NOW() WHERE id = $2
        `, [nextChapterNumber, projectId]);

        res.json({
            success: true,
            chapter: {
                ...chapter,
                content: {
                    keyPoints: chapterContent.keyPoints,
                    fullLesson: chapterContent.fullLesson,
                    whyItMatters: chapterContent.whyItMatters
                }
            },
            alternatives: availableSkills.slice(1).map(s => s.name) // Other options
        });

    } catch (error) {
        console.error('❌ Generate chapter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate chapter'
        });
    }
});

// Helper: Get context from previous chapter
async function getChapterContext(chapterId) {
    const result = await db.query(`
        SELECT title, content, focus_area FROM chapters WHERE id = $1
    `, [chapterId]);
    
    if (result.rows.length === 0) return null;
    const chapter = result.rows[0];
    return {
        title: chapter.title,
        focus: chapter.focus_area,
        keyPoints: chapter.content?.keyPoints || []
    };
}

/**
 * GET /api/chapters/:id
 * Get chapter with questions
 */
router.get('/chapters/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Get chapter
        const chapterResult = await db.query(`
            SELECT c.*, p.user_id, p.topic 
            FROM chapters c
            JOIN projects p ON c.project_id = p.id
            WHERE c.id = $1
        `, [id]);

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Chapter not found'
            });
        }

        const chapter = chapterResult.rows[0];

        // Verify ownership
        if (chapter.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get questions
        const questionsResult = await db.query(`
            SELECT * FROM questions 
            WHERE chapter_id = $1 
            ORDER BY order_index ASC
        `, [id]);

        // Update status to in_progress if not completed
        if (chapter.status === 'available') {
            await db.query(`
                UPDATE chapters SET status = 'in_progress' WHERE id = $1
            `, [id]);
            chapter.status = 'in_progress';
        }

        res.json({
            success: true,
            chapter: {
                ...chapter,
                content: chapter.content
            },
            questions: questionsResult.rows
        });

    } catch (error) {
        console.error('❌ Get chapter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get chapter'
        });
    }
});

// ============================================
// 3. QUESTION ATTEMPTS
// ============================================

/**
 * POST /api/attempts
 * Submit answer and get AI diagnosis
 * 
 * Body: { 
 *   questionId: string, 
 *   userAnswer: any, 
 *   timeSpentSeconds: number,
 *   artifactsReferenced?: string[]
 * }
 */
router.post('/attempts', authenticateToken, async (req, res) => {
    const { 
        questionId, 
        userAnswer, 
        timeSpentSeconds = 0,
        artifactsReferenced = []
    } = req.body;
    
    const userId = req.user.id;

    if (!questionId || userAnswer === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Question ID and answer are required'
        });
    }

    try {
        await setUserContext(userId);

        // Get question details
        const questionResult = await db.query(`
            SELECT q.*, c.project_id, c.id as chapter_id
            FROM questions q
            JOIN chapters c ON q.chapter_id = c.id
            JOIN projects p ON c.project_id = p.id
            WHERE q.id = $1 AND p.user_id = $2
        `, [questionId, userId]);

        if (questionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        const question = questionResult.rows[0];

        // Get attempt count
        const attemptCountResult = await db.query(`
            SELECT COUNT(*) as count FROM question_attempts
            WHERE question_id = $1 AND user_id = $2
        `, [questionId, userId]);

        const attemptNumber = parseInt(attemptCountResult.rows[0].count) + 1;

        // Validate answer
        const validation = validateAnswer(userAnswer, question);
        const isCorrect = validation.isCorrect;

        let aiDiagnosis = null;
        let misconceptionTag = null;

        // If wrong, get AI diagnosis
        if (!isCorrect) {
            console.log(`🔍 Generating AI diagnosis for question ${questionId}`);
            
            const diagnosis = await kimiService.generateDiagnosis({
                question: question.question_data,
                userAnswer,
                correctAnswer: question.correct_answer,
                previousAttempts: attemptNumber - 1
            });

            aiDiagnosis = diagnosis.diagnosis;
            misconceptionTag = diagnosis.misconception;
        }

        // Record attempt
        const attemptResult = await db.query(`
            INSERT INTO question_attempts (
                id, user_id, question_id, chapter_id, project_id,
                user_answer, is_correct, ai_diagnosis, misconception_tag,
                time_spent_seconds, artifacts_referenced, attempt_number,
                was_diagnosed, retry_after_diagnosis
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            generateId(),
            userId,
            questionId,
            question.chapter_id,
            question.project_id,
            JSON.stringify(userAnswer),
            isCorrect,
            aiDiagnosis,
            misconceptionTag,
            timeSpentSeconds,
            artifactsReferenced,
            attemptNumber,
            !isCorrect, // was_diagnosed
            attemptNumber > 1 // retry_after_diagnosis
        ]);

        const attempt = attemptResult.rows[0];

        // If correct, check if chapter is complete
        if (isCorrect) {
            // Check if all questions in chapter are correct
            const progressResult = await db.query(`
                SELECT 
                    COUNT(DISTINCT q.id) as total_questions,
                    COUNT(DISTINCT CASE WHEN qa.is_correct THEN qa.question_id END) as correct_questions
                FROM questions q
                LEFT JOIN question_attempts qa ON q.id = qa.question_id 
                    AND qa.user_id = $1 AND qa.is_correct = true
                WHERE q.chapter_id = $2
            `, [userId, question.chapter_id]);

            const { total_questions, correct_questions } = progressResult.rows[0];
            
            // Generate knowledge artifact if all questions correct
            if (parseInt(correct_questions) >= parseInt(total_questions)) {
                console.log(`✨ Generating knowledge artifact for chapter ${question.chapter_id}`);
                
                const artifact = await generateKnowledgeArtifact(
                    userId,
                    question.project_id,
                    question.chapter_id
                );

                res.json({
                    success: true,
                    isCorrect: true,
                    chapterComplete: true,
                    artifact: artifact,
                    message: 'Chapter complete! Knowledge artifact generated.'
                });
                return;
            }
        }

        res.json({
            success: true,
            isCorrect,
            diagnosis: aiDiagnosis,
            misconceptionTag,
            attemptNumber,
            attempt: {
                id: attempt.id,
                createdAt: attempt.created_at
            }
        });

    } catch (error) {
        console.error('❌ Submit attempt error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit attempt'
        });
    }
});

// Helper: Validate answer
function validateAnswer(userAnswer, question) {
    const correctAnswer = question.correct_answer;
    const type = question.question_type;

    switch (type) {
        case 'fill_blank':
            // Case-insensitive comparison for fill-in-blank
            const userStr = String(userAnswer).toLowerCase().trim();
            const correctStr = String(correctAnswer).toLowerCase().trim();
            return {
                isCorrect: userStr === correctStr
            };

        case 'multiple_choice':
        case 'error_analysis':
        case 'concept_synthesis':
            // Compare option IDs
            return {
                isCorrect: userAnswer === correctAnswer
            };

        case 'code_execution':
            // Code execution is validated server-side
            return {
                isCorrect: false, // Will be overridden by actual execution
                requiresExecution: true
            };

        default:
            return {
                isCorrect: JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)
            };
    }
}

// Helper: Generate knowledge artifact
async function generateKnowledgeArtifact(userId, projectId, chapterId) {
    // Get chapter content
    const chapterResult = await db.query(`
        SELECT c.*, p.topic, p.title as project_title
        FROM chapters c
        JOIN projects p ON c.project_id = p.id
        WHERE c.id = $1
    `, [chapterId]);

    if (chapterResult.rows.length === 0) return null;

    const chapter = chapterResult.rows[0];

    // Check if artifact already exists
    const existingResult = await db.query(`
        SELECT * FROM knowledge_artifacts 
        WHERE chapter_id = $1 AND user_id = $2
    `, [chapterId, userId]);

    if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
    }

    // Generate artifact with AI
    const artifactContent = await kimiService.generateKnowledgeArtifact({
        topic: chapter.topic,
        chapterTitle: chapter.title,
        focusArea: chapter.focus_area,
        keyPoints: chapter.content?.keyPoints || [],
        fullLesson: chapter.content?.fullLesson || ''
    });

    // Insert artifact
    const artifactResult = await db.query(`
        INSERT INTO knowledge_artifacts (
            id, user_id, project_id, chapter_id, title, 
            content, summary, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [
        generateId(),
        userId,
        projectId,
        chapterId,
        artifactContent.title,
        artifactContent.content,
        artifactContent.summary,
        artifactContent.tags
    ]);

    // Mark chapter as artifact_generated
    await db.query(`
        UPDATE chapters SET artifact_generated = true WHERE id = $1
    `, [chapterId]);

    return artifactResult.rows[0];
}

// ============================================
// 4. KNOWLEDGE ARTIFACTS
// ============================================

/**
 * GET /api/artifacts
 * Retrieve user's knowledge artifacts
 * 
 * Query: { projectId?: string, search?: string, tag?: string }
 */
router.get('/artifacts', authenticateToken, async (req, res) => {
    const { projectId, search, tag } = req.query;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        let query = `
            SELECT ka.*, c.title as chapter_title, c.chapter_number
            FROM knowledge_artifacts ka
            LEFT JOIN chapters c ON ka.chapter_id = c.id
            WHERE ka.user_id = $1
        `;
        
        const params = [userId];
        let paramIndex = 2;

        if (projectId) {
            query += ` AND ka.project_id = $${paramIndex}`;
            params.push(projectId);
            paramIndex++;
        }

        if (tag) {
            query += ` AND $${paramIndex} = ANY(ka.tags)`;
            params.push(tag);
            paramIndex++;
        }

        if (search) {
            query += ` AND ka.searchable_text @@ plainto_tsquery('english', $${paramIndex})`;
            params.push(search);
            paramIndex++;
        }

        query += ` ORDER BY ka.pin_order DESC, ka.created_at DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            artifacts: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Get artifacts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get artifacts'
        });
    }
});

/**
 * GET /api/artifacts/:id
 * Get single artifact
 */
router.get('/artifacts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Update view count and last accessed
        await db.query(`
            UPDATE knowledge_artifacts 
            SET view_count = view_count + 1, last_accessed_at = NOW()
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        const result = await db.query(`
            SELECT ka.*, c.title as chapter_title, p.title as project_title
            FROM knowledge_artifacts ka
            LEFT JOIN chapters c ON ka.chapter_id = c.id
            LEFT JOIN projects p ON ka.project_id = p.id
            WHERE ka.id = $1 AND ka.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artifact not found'
            });
        }

        res.json({
            success: true,
            artifact: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Get artifact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get artifact'
        });
    }
});

// ============================================
// 5. BOSS BATTLES
// ============================================

/**
 * POST /api/boss-battles/initiate
 * Initialize boss battle for a project
 * 
 * Body: { projectId: string }
 */
router.post('/boss-battles/initiate', authenticateToken, async (req, res) => {
    const { projectId } = req.body;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Check if battle already exists
        const existingResult = await db.query(`
            SELECT * FROM boss_battles 
            WHERE project_id = $1 AND user_id = $2
        `, [projectId, userId]);

        if (existingResult.rows.length > 0) {
            return res.json({
                success: true,
                battle: existingResult.rows[0],
                message: 'Boss battle already exists'
            });
        }

        // Get project and all artifacts
        const projectResult = await db.query(`
            SELECT p.*, 
                (SELECT COUNT(*) FROM chapters WHERE project_id = p.id AND status = 'completed') as completed_chapters
            FROM projects p
            WHERE p.id = $1 AND p.user_id = $2
        `, [projectId, userId]);

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const project = projectResult.rows[0];

        // Check if all chapters are completed
        if (parseInt(project.completed_chapters) < project.total_chapters) {
            return res.status(400).json({
                success: false,
                message: 'Complete all chapters before starting boss battle'
            });
        }

        // Get all artifacts for this project
        const artifactsResult = await db.query(`
            SELECT * FROM knowledge_artifacts 
            WHERE project_id = $1 AND user_id = $2
            ORDER BY created_at ASC
        `, [projectId, userId]);

        // Generate boss battle with AI
        console.log(`⚔️ Generating boss battle for project ${projectId}`);
        
        const battleContent = await kimiService.generateBossBattle({
            topic: project.topic,
            deliverable: project.deliverable,
            artifacts: artifactsResult.rows,
            skillTree: project.skill_tree
        });

        // Create boss battle record
        const battleResult = await db.query(`
            INSERT INTO boss_battles (
                id, project_id, user_id, title, description, scenario,
                deliverable, stages, status, total_stages, confidence_threshold,
                badge_earned, started_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            generateId(),
            projectId,
            userId,
            battleContent.title,
            battleContent.description,
            battleContent.scenario,
            battleContent.deliverable,
            JSON.stringify(battleContent.stages),
            'in_progress',
            battleContent.stages.length,
            70,
            `${project.topic} Master`,
            new Date()
        ]);

        const battle = battleResult.rows[0];

        res.json({
            success: true,
            battle: {
                ...battle,
                stages: battleContent.stages
            },
            artifacts: artifactsResult.rows,
            message: 'Boss battle initiated!'
        });

    } catch (error) {
        console.error('❌ Initiate boss battle error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate boss battle'
        });
    }
});

/**
 * POST /api/boss-battles/:id/stage/:stageNumber
 * Submit stage solution
 * 
 * Body: { solution: any, timeSpentSeconds?: number }
 */
router.post('/boss-battles/:id/stage/:stageNumber', authenticateToken, async (req, res) => {
    const { id, stageNumber } = req.params;
    const { solution, timeSpentSeconds = 0 } = req.body;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Get battle details
        const battleResult = await db.query(`
            SELECT * FROM boss_battles 
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        if (battleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Boss battle not found'
            });
        }

        const battle = battleResult.rows[0];
        const stageNum = parseInt(stageNumber);

        // Check if previous stages are complete
        if (stageNum > 1 && !battle.completed_stages.includes(stageNum - 1)) {
            return res.status(400).json({
                success: false,
                message: 'Complete previous stages first'
            });
        }

        // Get stage configuration
        const stages = battle.stages;
        const stage = stages[stageNum - 1];

        if (!stage) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stage number'
            });
        }

        // Get relevant artifacts for this stage
        const artifactsResult = await db.query(`
            SELECT * FROM knowledge_artifacts 
            WHERE project_id = $1 AND user_id = $2
            AND id = ANY($3)
        `, [battle.project_id, userId, stage.relevantArtifacts || []]);

        // Validate solution with AI
        console.log(`🎯 Validating stage ${stageNumber} solution`);
        
        const validation = await kimiService.validateBossStage({
            stage: stage,
            userSolution: solution,
            artifacts: artifactsResult.rows
        });

        const isPassed = validation.passed;

        // Record attempt
        await db.query(`
            INSERT INTO boss_stage_attempts (
                id, battle_id, user_id, stage_number, user_solution,
                status, ai_diagnosis, artifacts_highlighted, validation_results,
                time_spent_seconds
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            generateId(),
            id,
            userId,
            stageNum,
            JSON.stringify(solution),
            isPassed ? 'passed' : 'failed',
            validation.diagnosis,
            validation.highlightedArtifacts || [],
            JSON.stringify(validation.details),
            timeSpentSeconds
        ]);

        if (isPassed) {
            // Update completed stages
            const completedStages = [...battle.completed_stages, stageNum];
            const currentStage = stageNum + 1;
            
            let battleStatus = 'in_progress';
            let completedAt = null;

            // Check if all stages complete
            if (completedStages.length >= battle.total_stages) {
                battleStatus = 'completed';
                completedAt = new Date();

                // Mark project as completed
                await db.query(`
                    UPDATE projects 
                    SET status = 'completed', completed_at = NOW()
                    WHERE id = $1
                `, [battle.project_id]);
            }

            await db.query(`
                UPDATE boss_battles 
                SET completed_stages = $1, current_stage = $2, status = $3, completed_at = $4
                WHERE id = $5
            `, [completedStages, currentStage, battleStatus, completedAt, id]);

            res.json({
                success: true,
                passed: true,
                stageComplete: true,
                battleComplete: battleStatus === 'completed',
                badge: battleStatus === 'completed' ? battle.badge_earned : null,
                nextStage: battleStatus === 'completed' ? null : currentStage,
                message: battleStatus === 'completed' 
                    ? `🎉 Victory! You've earned the ${battle.badge_earned} badge!` 
                    : 'Stage passed! Continue to next stage.'
            });
        } else {
            // Add to failed stages
            const failedStages = [...battle.failed_stages, stageNum];
            await db.query(`
                UPDATE boss_battles 
                SET failed_stages = $1
                WHERE id = $2
            `, [failedStages, id]);

            res.json({
                success: true,
                passed: false,
                diagnosis: validation.diagnosis,
                highlightedArtifacts: validation.highlightedArtifacts,
                hint: validation.hint,
                message: 'Stage failed. Review the feedback and try again.'
            });
        }

    } catch (error) {
        console.error('❌ Submit stage solution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit solution'
        });
    }
});

/**
 * GET /api/boss-battles/:id
 * Get boss battle status
 */
router.get('/boss-battles/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        const battleResult = await db.query(`
            SELECT bb.*, p.title as project_title, p.topic
            FROM boss_battles bb
            JOIN projects p ON bb.project_id = p.id
            WHERE bb.id = $1 AND bb.user_id = $2
        `, [id, userId]);

        if (battleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Boss battle not found'
            });
        }

        const battle = battleResult.rows[0];

        // Get stage attempts
        const attemptsResult = await db.query(`
            SELECT * FROM boss_stage_attempts
            WHERE battle_id = $1 AND user_id = $2
            ORDER BY stage_number ASC, created_at ASC
        `, [id, userId]);

        res.json({
            success: true,
            battle,
            attempts: attemptsResult.rows
        });

    } catch (error) {
        console.error('❌ Get boss battle error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get boss battle'
        });
    }
});

// ============================================
// 6. PROGRESS & ANALYTICS
// ============================================

/**
 * GET /api/projects/:id/progress
 * Get detailed project progress
 */
router.get('/projects/:id/progress', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await setUserContext(userId);

        // Get project overview
        const projectResult = await db.query(`
            SELECT * FROM projects WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // Get chapter progress
        const chaptersResult = await db.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT q.id) as total_questions,
                COUNT(DISTINCT CASE WHEN qa.is_correct THEN qa.question_id END) as answered_correctly,
                BOOL_AND(c.artifact_generated) as has_artifact
            FROM chapters c
            LEFT JOIN questions q ON c.id = q.chapter_id
            LEFT JOIN question_attempts qa ON q.id = qa.question_id AND qa.user_id = $2
            WHERE c.project_id = $1
            GROUP BY c.id
            ORDER BY c.chapter_number
        `, [id, userId]);

        // Get attempt statistics
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total_attempts,
                COUNT(*) FILTER (WHERE is_correct) as correct_attempts,
                AVG(time_spent_seconds) as avg_time,
                COUNT(DISTINCT misconception_tag) as misconception_types
            FROM question_attempts
            WHERE project_id = $1 AND user_id = $2
        `, [id, userId]);

        // Get artifacts
        const artifactsResult = await db.query(`
            SELECT * FROM knowledge_artifacts
            WHERE project_id = $1 AND user_id = $2
            ORDER BY created_at DESC
        `, [id, userId]);

        res.json({
            success: true,
            project: projectResult.rows[0],
            chapters: chaptersResult.rows,
            stats: statsResult.rows[0],
            artifacts: artifactsResult.rows
        });

    } catch (error) {
        console.error('❌ Get progress error:', error);
        res.status(500).json({ success: false, message: 'Failed to get progress' });
    }
});

module.exports = router;
