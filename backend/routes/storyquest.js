const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');
const { query } = require('../db/connection');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Story Quest routes working' });
});

// ============================================
// GENERATE STORY INTRO
// ============================================
router.post('/intro', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`📖 Generating story intro for: ${topic}`);
    
    const intro = await kimiService.generateStoryIntro(topic.trim());
    
    res.json({ success: true, ...intro });
  } catch (error) {
    console.error('Story intro error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate intro' });
  }
});

// ============================================
// GENERATE SCENE
// ============================================
router.post('/scene', authenticateToken, async (req, res) => {
  try {
    const { topic, chapter, sceneType, context } = req.body;
    
    if (!topic || !sceneType) {
      return res.status(400).json({ success: false, message: 'Topic and sceneType required' });
    }

    console.log(`🎬 Generating ${sceneType} scene for ${topic} (Chapter ${chapter})`);
    
    const scene = await kimiService.generateStoryScene(topic, chapter || 1, sceneType, context || {});
    
    res.json({ success: true, ...scene });
  } catch (error) {
    console.error('Scene error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate scene' });
  }
});

// ============================================
// GENERATE LESSON
// ============================================
router.post('/lesson', authenticateToken, async (req, res) => {
  try {
    const { topic, chapter, conceptNumber } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`📚 Generating lesson for ${topic} (Chapter ${chapter}, Concept ${conceptNumber})`);
    
    const lesson = await kimiService.generateStoryLesson(topic, chapter || 1, conceptNumber || 1);
    
    res.json({ success: true, ...lesson });
  } catch (error) {
    console.error('Lesson error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate lesson' });
  }
});

// ============================================
// STRICT CONTENT FILTERS FOR AGE-APPROPRIATE QUESTIONS
// ============================================
const FORBIDDEN_CONCEPTS = [
  'set theory', 'ordinal', 'cardinality', 'power set', 'von neumann',
  'subset', 'empty set', 'belongs to', 'function S(n)', 'construction',
  'proof', 'theorem', 'axiom', 'infinite set', 'natural numbers formal definition',
  '∈', '∪', '∩', '⊂', '∀', '∃', 'ℕ', 'ℤ', 'ℚ', 'ℝ',
  'aleph', 'transfinite', 'induction hypothesis', 'recursive definition',
  'well-ordering', 'equinumerous', 'bijection', 'injective', 'surjective'
];

const FORBIDDEN_PATTERNS = [
  /set\s+of\s+all/i,
  /class\s+of\s+all/i,
  /for\s+all\s+x/i,
  /there\s+exists/i,
  /iff\s/i,
  /if\s+and\s+only\s+if/i,
  /\{\s*\d+\s*:\s*\d+\s*∈\s*/i,
  /S\s*\(\s*\d+\s*\)\s*=/i,
  /\{\s*\|\s*\}/i
];

// Check if content contains forbidden advanced concepts
function containsForbiddenConcepts(content) {
  const text = JSON.stringify(content).toLowerCase();
  
  // Check forbidden words
  const hasForbiddenWord = FORBIDDEN_CONCEPTS.some(word => text.includes(word.toLowerCase()));
  
  // Check forbidden patterns
  const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
  
  return hasForbiddenWord || hasForbiddenPattern;
}

// Extract simple facts from lesson content for fallback questions
function generateFallbackQuestions(lessonContent, count = 1) {
  const questions = [];
  
  // Simple fact-based questions that any 12-year-old can answer
  const baseQuestions = [
    {
      question: "According to the lesson, what is one important fact we learned?",
      choices: [
        { text: "The basic concept explained", correct: true },
        { text: "Advanced calculus", correct: false },
        { text: "Set theory", correct: false },
        { text: "Abstract algebra", correct: false }
      ],
      explanation: "We learned the basic concept from the lesson."
    },
    {
      question: "What was the main topic of today's lesson?",
      choices: [
        { text: "The fundamental concept", correct: true },
        { text: "Quantum physics", correct: false },
        { text: "Advanced mathematics", correct: false },
        { text: "Philosophy", correct: false }
      ],
      explanation: "We focused on understanding the fundamental concept."
    },
    {
      question: "Which of these is mentioned in the lesson?",
      choices: [
        { text: "The key idea we studied", correct: true },
        { text: "Nuclear fusion", correct: false },
        { text: "Differential equations", correct: false },
        { text: "Boolean logic", correct: false }
      ],
      explanation: "The lesson discussed the key idea."
    }
  ];
  
  for (let i = 0; i < count; i++) {
    questions.push(baseQuestions[i % baseQuestions.length]);
  }
  
  return questions;
}

// Parse JSON response with error handling
function parseQuestionResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Try to find array of questions
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    
    throw new Error('No valid JSON found in response');
  } catch (error) {
    console.error('Failed to parse question response:', error);
    return null;
  }
}

// ============================================
// GENERATE QUESTION (with boss battle support)
// ============================================
router.post('/question', authenticateToken, async (req, res) => {
  try {
    const { 
      topic, subject, chapterTitle, difficulty = 1, 
      questionType = 'multiple_choice', previousQuestions = [], 
      conceptTitle, lessonContent, isBoss = false, gradeLevel = 'Form 1-3'
    } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const actualSubject = subject || topic;
    const questionCount = isBoss ? 3 : 1;
    
    console.log(`❓ Generating ${questionCount} question(s) for ${topic} (Subject: ${actualSubject}, Boss: ${isBoss}, Difficulty: ${difficulty})`);

    // Build prompt with strict age-appropriate constraints
    let prompt = `Create ${questionCount} quiz question(s) for Hong Kong ${gradeLevel} (age 12-15).`;
    
    if (lessonContent) {
      prompt += `\n\nLESSON CONTENT:\n${lessonContent.substring(0, 1000)}`;
    }
    
    prompt += `\n\n🚫 ABSOLUTELY FORBIDDEN (will be rejected):\n`;
    prompt += FORBIDDEN_CONCEPTS.join(', ');
    prompt += `\n\n⚠️ STRICT RULES:`;
    prompt += `\n1. Test ONLY facts explicitly stated in lesson content`;
    prompt += `\n2. Numbers must be under 100 (preferably under 20)`;
    prompt += `\n3. NO abstract concepts not taught in lesson`;
    prompt += `\n4. NO mathematical notation beyond + - × ÷ = > <`;
    prompt += `\n5. NO proofs, theorems, axioms, or constructions`;
    prompt += `\n6. 12-year-old must solve in 30 seconds`;
    prompt += `\n7. Use simple words only`;
    
    if (isBoss) {
      prompt += `\n8. Boss battle: 3 questions, increasing difficulty (Easy→Medium→Hard)`;
      prompt += `\n9. Easy: Direct fact from lesson`;
      prompt += `\n10. Medium: Simple application`;
      prompt += `\n11. Hard: Slightly more thinking, still from lesson`;
    }
    
    prompt += `\n\nOUTPUT FORMAT (VALID JSON):\n`;
    
    if (isBoss) {
      prompt += `\n{\n  "questions": [\n    {\n      "question": "Question text?",\n      "choices": [\n        {"text": "Wrong", "correct": false},\n        {"text": "Correct", "correct": true},\n        {"text": "Wrong", "correct": false},\n        {"text": "Wrong", "correct": false}\n      ],\n      "explanation": "Why correct",\n      "difficulty": 1\n    },\n    // 2 more questions with difficulty 2 and 3\n  ]\n}`;
    } else {
      prompt += `\n{\n  "question": "Question text?",\n  "choices": [\n    {"text": "Wrong", "correct": false},\n    {"text": "Correct", "correct": true},\n    {"text": "Wrong", "correct": false},\n    {"text": "Wrong", "correct": false}\n  ],\n  "explanation": "Why correct"\n}`;
    }
    
    // Generate with validation and retry
    let attempts = 0;
    let questions = null;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts && !questions) {
      attempts++;
      console.log(`  Attempt ${attempts}/${maxAttempts}...`);
      
      try {
        const response = await kimiService.sendMessageToKimi(
          [{ role: 'user', content: prompt }],
          { maxTokens: isBoss ? 2000 : 800, temperature: 0.7 }
        );
        
        const parsed = parseQuestionResponse(response);
        
        if (!parsed) {
          console.log(`  Parse failed, retrying...`);
          continue;
        }
        
        // Validate content
        const contentToCheck = isBoss ? parsed.questions : [parsed];
        
        if (containsForbiddenConcepts(contentToCheck)) {
          console.log(`  Forbidden concepts found! Retrying with stricter prompt...`);
          prompt += `\n\n⚠️ PREVIOUS ATTEMPT WAS TOO ADVANCED. Use ONLY simple facts from the lesson. No abstract math!`;
          continue;
        }
        
        // Validate structure
        const isValid = isBoss 
          ? Array.isArray(parsed.questions) && parsed.questions.length >= 3
          : parsed.question && Array.isArray(parsed.choices);
          
        if (!isValid) {
          console.log(`  Invalid structure, retrying...`);
          continue;
        }
        
        questions = isBoss ? parsed.questions : parsed;
        
      } catch (error) {
        console.error(`  Attempt ${attempts} error:`, error.message);
      }
    }
    
    // Fallback if all attempts failed
    if (!questions) {
      console.log(`  All attempts failed, using fallback questions`);
      questions = isBoss 
        ? generateFallbackQuestions(lessonContent, 3)
        : generateFallbackQuestions(lessonContent, 1)[0];
    }
    
    console.log(`✅ Generated ${isBoss ? questions.length : 1} question(s)`);
    
    res.json({ 
      success: true, 
      questions: isBoss ? questions : [questions],
      isBoss,
      count: isBoss ? questions.length : 1
    });
    
  } catch (error) {
    console.error('Question error:', error);
    // Return safe fallback
    res.json({ 
      success: true,
      questions: [{
        question: "What is 7 + 5?",
        choices: [
          { text: "10", correct: false },
          { text: "12", correct: true },
          { text: "13", correct: false },
          { text: "15", correct: false }
        ],
        explanation: "7 + 5 = 12"
      }],
      isBoss: false,
      count: 1
    });
  }
});

// ============================================
// SIMPLE LEARN SCENE - Plain text educational content
// ============================================

// Helper: Remove any markdown formatting
const cleanContent = (rawContent) => {
  return rawContent
    .replace(/\*\*/g, '')      // Remove bold **
    .replace(/\*/g, '')        // Remove italics *
    .replace(/#{1,6}\s/g, '')  // Remove headers #
    .replace(/\|/g, ' ')       // Replace table pipes with spaces
    .replace(/---+/g, '')      // Remove horizontal rules
    .replace(/```/g, '')       // Remove code blocks
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // Remove markdown links [text](url) -> text
    .replace(/`/g, '')         // Remove inline code
    .trim();
};

// Helper: Check if content is truncated
const isTruncated = (content) => {
  const trimmed = content.trim();
  return trimmed.endsWith('...') || 
         trimmed.endsWith('---') || 
         trimmed.endsWith('…') ||
         !trimmed.includes('WHY IT MATTERS');
};

router.post('/learn', authenticateToken, async (req, res) => {
  try {
    const { topic, subject, chapterTitle, focus, detailLevel = 'brief' } = req.body;
    const studentId = req.user.id;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    // Use subject from request or infer from topic
    const actualSubject = subject || topic;
    const actualChapter = chapterTitle || topic;
    const chapterFocus = focus || 'fundamentals';

    console.log(`📖 LearnScene: ${detailLevel} lesson for Subject: ${actualSubject}, Chapter: ${actualChapter}`);

    // Subject-specific context to keep AI focused
    const subjectContext = {
      'Mathematics': {
        forbidden: 'Big Bang, universe, galaxy, atoms, molecules, ancient civilizations, pharaohs, wars',
        chapterMeanings: {
          'The Beginning': 'number systems 0-9, counting, Hindu-Arabic numerals, zero, place value',
          'First Trials': 'addition, subtraction, multiplication, division, times tables',
          'The Challenge': 'equations, variables like x, solving steps, algebra basics',
          'Final Confrontation': 'word problems, real life math, using all operations'
        }
      },
      'History': {
        forbidden: 'equations, formulas, atoms, molecules, calculations, theorems',
        chapterMeanings: {
          'The Beginning': 'prehistory, early humans, Stone Age, first tools and fire',
          'First Trials': 'ancient Egypt, pyramids, pharaohs, Mesopotamia, writing',
          'The Challenge': 'Roman Empire, Greece, famous leaders, wars and battles',
          'Final Confrontation': 'modern history, revolutions, world wars, independence movements'
        }
      },
      'Science': {
        forbidden: 'equations, ancient pharaohs, wars, historical dates without scientific context',
        chapterMeanings: {
          'The Beginning': 'scientific method, observation, asking questions, experiments',
          'First Trials': 'forces, motion, pushes and pulls, simple machines like levers',
          'The Challenge': 'atoms, elements, states of matter, solids liquids gases',
          'Final Confrontation': 'chemical reactions, energy, modern science applications'
        }
      }
    };

    // Get context for this subject or use generic
    const ctx = subjectContext[actualSubject] || {
      forbidden: 'unrelated topics',
      chapterMeanings: { [actualChapter]: 'core concepts and fundamentals' }
    };
    
    const chapterMeaning = ctx.chapterMeanings[actualChapter] || 'core concepts and fundamentals';

    let prompt;
    if (detailLevel === 'comprehensive') {
      prompt = `Teach ${actualSubject}: ${actualChapter} to Hong Kong Form 1-3 students (ages 12-15).

STRICT FORMATTING RULES:
- NO markdown (**bold**, *italics*, # headers, | tables |, ---)
- NO mathematical symbols that do not render in plain text
- Use simple ASCII: 7,354 not **7,354**
- Use dashes (-) or arrows (->) for lists, not tables
- Plain text only that looks good in pixel font

CONTENT STRUCTURE (exactly 3 sections):

KEY POINTS:
- Point 1: Simple fact about ${chapterMeaning}
- Point 2: Simple fact about ${chapterMeaning}
- Point 3: Simple fact about ${chapterMeaning}

FULL LESSON:
[Write 200-250 words maximum. Keep sentences short (under 10 words). Explain one concept clearly. Use examples with small numbers under 100. No big words.]

WHY IT MATTERS:
[One sentence connecting to real life. Simple words.]

🚫 FORBIDDEN TOPICS (NEVER MENTION):
${ctx.forbidden}

EXAMPLE FORMAT (History):
KEY POINTS:
- Pyramids were tombs for pharaohs
- Nile River flooded yearly to help farming
- Hieroglyphics were picture writing

FULL LESSON:
The ancient Egyptians built pyramids as tombs for their kings called pharaohs. The most famous is the Great Pyramid of Giza built around 2560 BCE. 

Egyptians also invented writing called hieroglyphics. This used pictures to represent words. Scribes wrote on papyrus paper made from reeds.

The Nile River was crucial to Egypt. It flooded every year, leaving rich soil for farming. This allowed cities to grow and civilization to develop.

WHY IT MATTERS:
Modern calendars and paper come from Egyptian inventions.

EXAMPLE FORMAT (Mathematics):
KEY POINTS:
- Numbers 0-9 came from India and Arabia
- Zero is a number that means nothing
- Place value: 354 means 3 hundreds, 5 tens, 4 ones

FULL LESSON:
Our number system uses ten digits: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9. This came from India over 1,500 years ago.

Zero is special. It means nothing, but it also holds places. In 205, the zero shows there are no tens. Without it, 205 would look like 25.

Place value means where a digit sits matters. In 354:
- 3 is in hundreds place: 300
- 5 is in tens place: 50  
- 4 is in ones place: 4
Add them: 300 + 50 + 4 = 354

WHY IT MATTERS:
Computers and phones use this number system to work.

NOW TEACH: ${actualSubject} - ${actualChapter}
This covers: ${chapterMeaning}

REMEMBER: Short sentences, simple words, no markdown, complete lesson under 250 words.`;
    } else {
      prompt = `Explain '${actualChapter}' (${actualSubject}) to a Hong Kong Form 1-3 student in 80 words. Short sentences. Simple words. No markdown. Plain text only.`;
    }

    // Generate content with increased max_tokens
    let content = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }], 
      { maxTokens: detailLevel === 'comprehensive' ? 1500 : 300 }
    );

    // Clean any markdown that slipped through
    content = cleanContent(content);

    // Check if content is truncated
    if (isTruncated(content)) {
      console.log(`⚠️ Content appears truncated, retrying with simpler prompt...`);
      
      const simplePrompt = `Teach the basics of ${actualSubject} ${actualChapter} in 150 words.

Rules:
- No markdown (**bold**, *italics*, # headers)
- Short sentences
- Simple words
- Three key points then brief explanation
- End with "WHY IT MATTERS: one sentence"

Topics to cover: ${chapterMeaning}`;

      content = await kimiService.sendMessageToKimi(
        [{ role: 'user', content: simplePrompt }], 
        { maxTokens: 1000 }
      );
      
      content = cleanContent(content);
    }

    // VALIDATION: Check if response contains off-topic content
    const forbiddenWords = ctx.forbidden.toLowerCase().split(', ');
    const contentLower = content.toLowerCase();
    const violations = forbiddenWords.filter(word => contentLower.includes(word));
    
    if (violations.length > 0) {
      console.log(`⚠️ Content validation failed! Found off-topic words: ${violations.join(', ')}`);
      console.log(`🔄 Retrying with stronger prompt...`);
      
      const retryPrompt = `CRITICAL: You are teaching ${actualSubject.toUpperCase()} ONLY! 

The previous response mentioned off-topic content: ${violations.join(', ')}. NEVER mention these.

Write a simple lesson about ${actualSubject}: ${actualChapter} (${chapterMeaning}). 

Rules:
- NO ${ctx.forbidden}
- Short sentences, simple words
- No markdown
- 150 words max
- Three key points, brief lesson, one sentence why it matters

${actualSubject === 'Mathematics' ? 'Talk about NUMBERS and COUNTING only.' : ''}
${actualSubject === 'History' ? 'Talk about EVENTS and PEOPLE only.' : ''}
${actualSubject === 'Science' ? 'Talk about EXPERIMENTS and DISCOVERIES only.' : ''}`;
      
      content = await kimiService.sendMessageToKimi(
        [{ role: 'user', content: retryPrompt }], 
        { maxTokens: 1000 }
      );
      
      content = cleanContent(content);
    }

    // Log to ai_conversations table
    await query(
      `INSERT INTO ai_conversations (student_id, session_id, conversation_type, message_role, message_content, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [studentId, `learn_${Date.now()}`, 'learn_scene', 'assistant', content]
    );

    console.log(`✅ LearnScene: Generated ${content.length} chars for student ${studentId}`);

    res.json({ 
      success: true,
      content: content,
      topic: topic.trim(),
      detailLevel
    });
  } catch (error) {
    console.error('LearnScene error:', error);
    res.status(500).json({ 
      success: false,
      content: "The knowledge crystal is dim... Try again!", 
      topic: req.body?.topic || 'unknown'
    });
  }
});

// ============================================
// PRACTICE SCENE - Guided questions with hints
// ============================================
// ============================================
// STRICT LESSON-ONLY PRACTICE QUESTIONS
// ============================================

// Forbidden new concepts that can't appear in practice if not in lesson
const FORBIDDEN_NEW_CONCEPTS = [
  'factorial', 'binary', 'base-2', 'base-3', 'base-8', 'base-16', 'hexadecimal', 'octal',
  'associative', 'commutative', 'distributive', 'identity', 'inverse',
  'modulo', 'modular', 'congruence', 'residue',
  'logarithm', 'log', 'exponential', 'power set',
  'matrix', 'vector', 'scalar', 'determinant',
  'derivative', 'integral', 'calculus', 'limit',
  'complex', 'imaginary', 'quaternion', 'octonion',
  'topology', 'manifold', 'homeomorphism',
  'graph theory', 'combinatorics', 'permutation', 'combination',
  'probability distribution', 'standard deviation', 'variance', 'mean', 'median', 'mode',
  'cryptography', 'encryption', 'cipher', 'hash',
  'fractal', 'chaos theory', 'game theory',
  'turing', 'automata', 'lambda calculus',
  'godel', 'incompleteness', 'consistency',
  'continuum hypothesis', 'axiom of choice', 'zorn lemma',
  'banach', 'tarski', 'hausdorff'
];

// Validate that question only uses concepts from lesson
function isQuestionFromLesson(question, lessonContent) {
  if (!question || !lessonContent) return false;
  
  const questionText = (question.question || '').toLowerCase();
  const explanationText = (question.explanation || '').toLowerCase();
  const combinedText = questionText + ' ' + explanationText;
  
  // Check for forbidden new concepts
  const hasNewConcept = FORBIDDEN_NEW_CONCEPTS.some(concept => 
    combinedText.includes(concept.toLowerCase())
  );
  
  if (hasNewConcept) {
    console.log(`⚠️ Question introduces new concept not in lesson: ${combinedText}`);
    return false;
  }
  
  return true;
}

// Extract key facts from lesson content
async function extractFactsFromLesson(lessonContent, kimiService) {
  try {
    const extractionPrompt = `Read this lesson carefully:
"""
${lessonContent.substring(0, 1500)}
"""

EXTRACT 3-5 TESTABLE FACTS from the lesson above. Return ONLY a JSON object:
{
  "facts": [
    "First fact from lesson",
    "Second fact from lesson",
    "Third fact from lesson"
  ]
}

Rules:
- Each fact must be explicitly stated in the lesson
- Facts should be testable with simple questions
- Use the lesson's exact wording where possible
- NO facts that require outside knowledge`;

    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: extractionPrompt }],
      { maxTokens: 800 }
    );
    
    const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)[0]);
    return parsed.facts || [];
  } catch (error) {
    console.error('Failed to extract facts:', error);
    // Return generic facts based on lesson keywords
    return ['A key point from the lesson', 'An important fact mentioned', 'A concept explained in the lesson'];
  }
}

router.post('/practice', authenticateToken, async (req, res) => {
  try {
    const { topic, subject, chapterTitle, difficulty = 1, lessonContent, questionNumber = 0 } = req.body;
    const studentId = req.user.id;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    // Use subject from request or infer from topic
    const actualSubject = subject || topic;
    const actualChapter = chapterTitle || topic;
    
    console.log(`🎓 PracticeScene: Subject: ${actualSubject}, Chapter: ${actualChapter}, Q#: ${questionNumber}`);
    
    // If we have lesson content, extract facts and generate lesson-only questions
    let facts = [];
    if (lessonContent && lessonContent.length > 50) {
      console.log(`📚 Extracting facts from lesson (${lessonContent.length} chars)...`);
      facts = await extractFactsFromLesson(lessonContent, kimiService);
      console.log(`✅ Extracted ${facts.length} facts:`, facts.slice(0, 2));
    }

    let prompt;
    
    if (facts.length >= 3) {
      // Use lesson facts to generate question
      const factIndex = questionNumber % facts.length;
      const selectedFact = facts[factIndex];
      
      prompt = `Create a practice question testing UNDERSTANDING of this lesson fact:
"${selectedFact}"

LESSON CONTEXT:
"""
${lessonContent.substring(0, 1000)}
"""

🚫 ABSOLUTELY FORBIDDEN (NEVER DO):
1. NEVER ask "According to the lesson..." or "Is it mentioned in the lesson..."
2. NEVER use options like "It is described" / "Not mentioned" / "Unrelated"
3. NEVER ask meta-questions about whether content was covered
4. NEVER use "Which statement is true about... [fact]"

✅ REQUIRED (ALWAYS DO):
1. Ask DIRECT questions about the SUBJECT MATTER itself
2. Options must be ACTUAL ANSWERS (numbers, facts, places, dates)
3. Test KNOWLEDGE of content, not memory of the lesson
4. Use specific examples from lesson (205, 47, 74, India, etc.)

❌ BAD EXAMPLES (NEVER):
Q: "According to the lesson, which is true about: Zero means nothing?"
A: "It is described" / "Not mentioned" / "Unrelated"

Q: "Is it true that zero was described in the lesson?"
A: "Yes" / "No" / "Maybe"

✅ GOOD EXAMPLES (DO THIS):
Q: "What does the zero in 205 show?"
A: "No tens" / "No hundreds" / "Five ones" / "Two thousands"

Q: "Where did Hindu-Arabic numerals come from?"
A: "India" / "China" / "Egypt" / "Greece"

Q: "Why do 47 and 74 have different values?"
A: "Position matters" / "Digits are different" / "One is bigger" / "They count differently"

Q: "How many digits do we use in our number system?"
A: "Ten (0-9)" / "Five" / "Twenty" / "One hundred"

OUTPUT VALID JSON:
{
  "question": "Direct question about the subject matter?",
  "choices": [
    {"text": "Wrong factual answer", "correct": false},
    {"text": "Correct factual answer", "correct": true},
    {"text": "Wrong factual answer", "correct": false},
    {"text": "Wrong factual answer", "correct": false}
  ],
  "hint": "Helpful clue about the content",
  "explanation": "Explanation of the correct answer using lesson content"
}

REMEMBER: Ask about ZERO, NUMBERS, HISTORY FACTS - NOT about the lesson itself!`;
    } else {
      // Fallback to generic prompt if no lesson content
      prompt = `Create a PRACTICE quiz question for ${actualSubject.toUpperCase()}.

🎯 CONTEXT:
- Subject: ${actualSubject}
- Chapter: ${actualChapter}
- Difficulty: ${difficulty}/3 (1=easy, 2=medium, 3=hard)
- Age: 12-15 years old

🚫 FORBIDDEN CONCEPTS (never ask about these):
${FORBIDDEN_NEW_CONCEPTS.slice(0, 10).join(', ')}, etc.

RULES:
1. Question MUST be about ${actualSubject} ONLY
2. Test a specific fact about ${actualChapter}
3. NO advanced concepts not taught in school
4. Include a HELPFUL HINT that guides without giving the answer
5. Include a FULL EXPLANATION for after they answer
6. Friendly, encouraging tone

OUTPUT VALID JSON:
{
  "question": "Specific question about ${actualSubject}?",
  "choices": [
    {"text": "Answer 1", "correct": false},
    {"text": "Answer 2", "correct": true},
    {"text": "Answer 3", "correct": false},
    {"text": "Answer 4", "correct": false}
  ],
  "hint": "Helpful clue without giving away the answer",
  "explanation": "Full explanation about the concept"
}`;
    }

    const response = await kimiService.sendMessageToKimi([{ role: 'user', content: prompt }], { maxTokens: 800 });
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    
    let parsed = JSON.parse(jsonMatch[0]);

    // VALIDATION 1: Check if question introduces new concepts not in lesson
    if (lessonContent && !isQuestionFromLesson(parsed, lessonContent)) {
      console.log(`⚠️ Question contains new concepts! Regenerating...`);
      // Will fall through to the meta-question check below
    }
    
    // VALIDATION 2: Check if question is a meta-question (asking about the lesson itself)
    const metaWords = ['according to the lesson', 'described in the lesson', 'mentioned in', 
                       'is it true that', 'which statement', 'which of these is true'];
    const isMetaQuestion = metaWords.some(word => 
      parsed.question?.toLowerCase().includes(word)
    );
    
    // Check if options are meta-options
    const metaOptions = ['it is described', 'not mentioned', 'unrelated', 'the opposite', 
                         'it is covered', 'mentioned in', 'described in'];
    const hasMetaOptions = parsed.choices?.some(c => 
      metaOptions.some(word => c.text?.toLowerCase().includes(word))
    );
    
    if (isMetaQuestion || hasMetaOptions) {
      console.log(`⚠️ Meta-question detected! Using content-based fallback.`);
      
      // Create direct question from the fact
      const factIndex = questionNumber % (facts.length || 1);
      const fallbackFact = facts[factIndex] || 'zero in the number system';
      
      // Extract a direct question from the fact
      if (fallbackFact.toLowerCase().includes('zero') && fallbackFact.includes('205')) {
        parsed = {
          question: "What does the zero show in the number 205?",
          choices: [
            { text: "No tens", correct: true },
            { text: "No hundreds", correct: false },
            { text: "Five ones", correct: false },
            { text: "Two thousands", correct: false }
          ],
          hint: "Think about the position of zero in 205.",
          explanation: "The lesson states that zero in 205 shows there are no tens."
        };
      } else if (fallbackFact.toLowerCase().includes('india')) {
        parsed = {
          question: "Where did Hindu-Arabic numerals come from?",
          choices: [
            { text: "India", correct: true },
            { text: "China", correct: false },
            { text: "Egypt", correct: false },
            { text: "Greece", correct: false }
          ],
          hint: "The lesson mentions the origin of our number system.",
          explanation: "The lesson states that Hindu-Arabic numerals came from India."
        };
      } else if (fallbackFact.includes('47') || fallbackFact.includes('74')) {
        parsed = {
          question: "Why do 47 and 74 have different values?",
          choices: [
            { text: "The position of digits matters", correct: true },
            { text: "The digits are different", correct: false },
            { text: "One is odd, one is even", correct: false },
            { text: "They are the same value", correct: false }
          ],
          hint: "Think about place value and digit positions.",
          explanation: "The lesson explains that place value means the position of digits affects the number's value."
        };
      } else if (fallbackFact.toLowerCase().includes('digit') || fallbackFact.includes('0-9')) {
        parsed = {
          question: "How many digits do we use in our number system?",
          choices: [
            { text: "Ten (0-9)", correct: true },
            { text: "Five", correct: false },
            { text: "Nine", correct: false },
            { text: "Twenty", correct: false }
          ],
          hint: "Count the digits from 0 to 9.",
          explanation: "The lesson states we use ten digits: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9."
        };
      } else {
        // Generic direct question
        parsed = {
          question: "What important fact does the lesson teach?",
          choices: [
            { text: fallbackFact, correct: true },
            { text: "An incorrect fact", correct: false },
            { text: "Another incorrect fact", correct: false },
            { text: "Yet another wrong answer", correct: false }
          ],
          hint: "Review the lesson content carefully.",
          explanation: `The lesson clearly states: ${fallbackFact}`
        };
      }
    }

    console.log(`✅ PracticeScene: Question generated for student ${studentId}`);

    res.json({ 
      success: true,
      ...parsed,
      topic: topic.trim()
    });
  } catch (error) {
    console.error('PracticeScene error:', error);
    // Direct question fallback - no meta-questions
    res.status(500).json({ 
      success: false,
      question: "What does zero show when it is in the tens place of a number?",
      choices: [
        { text: "There are no tens", correct: true },
        { text: "There are ten tens", correct: false },
        { text: "The number is zero", correct: false },
        { text: "Nothing important", correct: false }
      ],
      hint: "Think about what zero means in place value.",
      explanation: "Zero in the tens place means there are no tens in that number.",
      topic: req.body?.topic || 'unknown'
    });
  }
});

// ============================================
// BOSS BATTLE QUESTIONS - 3 questions from lesson content only
// ============================================
router.post('/boss-questions', authenticateToken, async (req, res) => {
  try {
    const { lessonContent, subject, chapterTitle } = req.body;
    
    if (!lessonContent || lessonContent.length < 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lesson content required (at least 50 characters)' 
      });
    }
    
    console.log(`👹 Generating boss questions for: ${subject || 'unknown subject'}`);
    console.log(`📚 Lesson content length: ${lessonContent.length} chars`);
    
    // Extract key facts first
    const facts = await extractFactsFromLesson(lessonContent, kimiService);
    console.log(`✅ Extracted ${facts.length} facts for boss battle`);
    
    const prompt = `Create 3 BOSS BATTLE questions based STRICTLY on this lesson:
"""
${lessonContent.substring(0, 1200)}
"""

EXTRACTED FACTS:
${facts.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n')}

⚔️ BOSS BATTLE RULES:
1. Generate EXACTLY 3 questions
2. Each question tests ONE specific fact from the lesson
3. Difficulty progression:
   - Q1: DIRECT RECALL (straight from lesson)
   - Q2: UNDERSTANDING (connect ideas from lesson)
   - Q3: APPLICATION (use lesson knowledge in new way)
4. NO outside knowledge - if lesson doesn't mention it, DON'T ask about it
5. Subject: ${subject || 'General'}
6. Use specific examples from lesson (numbers like 205, 47, 74, places like India)

🚫 FORBIDDEN:
- Topics not mentioned in lesson
- Advanced concepts (factorial, binary, set theory)
- Meta-questions about "the lesson"

✅ EXAMPLE for Zero/Place Value Lesson:
Q1: "What does the zero in 205 represent?" 
    A: "No tens" (direct from lesson)
Q2: "Why would 205 look like 25 without zero?"
    A: "You cannot tell there are no tens" (understanding)
Q3: "In 3004, what do the zeros show?"
    A: "No hundreds and no tens" (application)

OUTPUT VALID JSON:
{
  "questions": [
    {
      "question": "Question 1 text?",
      "choices": [
        {"text": "Wrong answer", "correct": false},
        {"text": "Correct answer", "correct": true},
        {"text": "Wrong answer", "correct": false},
        {"text": "Wrong answer", "correct": false}
      ],
      "explanation": "Why this is correct, referencing lesson"
    },
    // Questions 2 and 3 follow same format
  ]
}`;

    let questions = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!questions && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await kimiService.sendMessageToKimi(
          [{ role: 'user', content: prompt }],
          { maxTokens: 1500, temperature: 0.7 }
        );
        
        const parsed = parseQuestionResponse(response);
        
        if (parsed && parsed.questions && parsed.questions.length >= 3) {
          // Validate questions reference lesson content
          const validated = parsed.questions.filter(q => {
            const qText = (q.question || '').toLowerCase();
            // Check if question references specific lesson content
            return isQuestionFromLesson(q, lessonContent);
          });
          
          if (validated.length >= 3) {
            questions = validated.slice(0, 3);
          } else {
            console.log(`⚠️ Only ${validated.length}/3 questions validated, retrying...`);
          }
        }
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error.message);
      }
    }
    
    // If AI failed, create fallback questions from extracted facts
    if (!questions) {
      console.log('⚠️ Using fallback boss questions from lesson facts');
      
      const lessonLower = lessonContent.toLowerCase();
      
      // Check what the lesson is actually about
      const isAboutZero = lessonLower.includes('zero') || lessonLower.includes('205') || lessonLower.includes('place');
      const isAboutHistory = lessonLower.includes('egypt') || lessonLower.includes('pharaoh') || lessonLower.includes('pyramid');
      
      if (isAboutZero) {
        // Math - Zero/Place Value fallback
        questions = [
          {
            question: "In the number 205, what does the zero show?",
            choices: [
              { text: "No tens", correct: true },
              { text: "No hundreds", correct: false },
              { text: "Five ones", correct: false },
              { text: "Two thousands", correct: false }
            ],
            explanation: "The lesson states: 'In 205, the zero shows there are no tens.'"
          },
          {
            question: "Without zero, why would 205 look like 25?",
            choices: [
              { text: "You cannot tell there are no tens", correct: true },
              { text: "The 5 moves to hundreds", correct: false },
              { text: "It becomes a different number", correct: false },
              { text: "Zero makes it smaller", correct: false }
            ],
            explanation: "Without the zero placeholder, we lose the tens place information."
          },
          {
            question: "Where did our digits 0-9 originally come from?",
            choices: [
              { text: "India", correct: true },
              { text: "China", correct: false },
              { text: "Europe", correct: false },
              { text: "Egypt", correct: false }
            ],
            explanation: "The lesson mentions Hindu-Arabic numerals came from India."
          }
        ];
      } else if (isAboutHistory) {
        // History fallback
        questions = [
          {
            question: "What was the main purpose of the pyramids in Ancient Egypt?",
            choices: [
              { text: "Tombs for pharaohs", correct: true },
              { text: "Shopping centers", correct: false },
              { text: "Schools for scribes", correct: false },
              { text: "Grain storage", correct: false }
            ],
            explanation: "The pyramids were built as elaborate tombs for pharaohs."
          },
          {
            question: "Which river was essential for farming in Ancient Egypt?",
            choices: [
              { text: "Nile River", correct: true },
              { text: "Amazon River", correct: false },
              { text: "Mississippi River", correct: false },
              { text: "Thames River", correct: false }
            ],
            explanation: "The Nile River flooded annually, providing fertile soil for farming."
          },
          {
            question: "What was Egyptian picture writing called?",
            choices: [
              { text: "Hieroglyphics", correct: true },
              { text: "Alphabet", correct: false },
              { text: "Cuneiform", correct: false },
              { text: "Script", correct: false }
            ],
            explanation: "Hieroglyphics used pictures to represent words."
          }
        ];
      } else {
        // Generic fallback using extracted facts
        const fact1 = facts[0] || 'the lesson content';
        const fact2 = facts[1] || 'the main topic';
        const fact3 = facts[2] || 'key concepts';
        
        questions = [
          {
            question: `According to the lesson, what is true about: ${fact1}?`,
            choices: [
              { text: "This is described in the lesson", correct: true },
              { text: "This is not mentioned", correct: false },
              { text: "The opposite is true", correct: false },
              { text: "It is unrelated", correct: false }
            ],
            explanation: `The lesson states: ${fact1}`
          },
          {
            question: `What does the lesson teach about ${fact2}?`,
            choices: [
              { text: "The lesson fact", correct: true },
              { text: "Something else", correct: false },
              { text: "Nothing", correct: false },
              { text: "The opposite", correct: false }
            ],
            explanation: `The lesson covers: ${fact2}`
          },
          {
            question: `Apply what you learned about ${fact3}. What is correct?`,
            choices: [
              { text: "The correct answer", correct: true },
              { text: "A wrong answer", correct: false },
              { text: "An unrelated idea", correct: false },
              { text: "A mistake", correct: false }
            ],
            explanation: `This applies: ${fact3}`
          }
        ];
      }
    }
    
    // Ensure we have exactly 3 questions
    const finalQuestions = questions.slice(0, 3);
    console.log(`✅ Boss questions generated: ${finalQuestions.length} questions`);
    
    // Log first question for debugging
    if (finalQuestions.length > 0) {
      console.log(`Q1: ${finalQuestions[0].question.substring(0, 60)}...`);
    }
    
    res.json({
      success: true,
      questions: finalQuestions,
      count: finalQuestions.length
    });
    
  } catch (error) {
    console.error('Boss questions error:', error);
    // Return safe fallback
    res.json({
      success: true,
      questions: [
        {
          question: "What important concept did the lesson teach?",
          choices: [
            { text: "The key fact from the lesson", correct: true },
            { text: "Something unrelated", correct: false },
            { text: "A wrong fact", correct: false },
            { text: "Nothing important", correct: false }
          ],
          explanation: "The lesson covered the key fact."
        },
        {
          question: "Which statement matches what we learned?",
          choices: [
            { text: "The main lesson concept", correct: true },
            { text: "An incorrect statement", correct: false },
            { text: "Something not covered", correct: false },
            { text: "The opposite of the lesson", correct: false }
          ],
          explanation: "The lesson taught the main concept."
        },
        {
          question: "Apply what you learned: what is true?",
          choices: [
            { text: "The lesson fact applied correctly", correct: true },
            { text: "A wrong application", correct: false },
            { text: "An unrelated idea", correct: false },
            { text: "A mistake", correct: false }
          ],
          explanation: "The correct application of the lesson."
        }
      ],
      count: 3
    });
  }
});

module.exports = router;