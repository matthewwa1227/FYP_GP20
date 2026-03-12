const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');
const contentService = require('../services/contentService');
const fs = require('fs').promises;

// ============================================
// MULTER CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/exercises/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype) || 
      file.originalname.match(/\.(txt|md|pdf|docx|jpg|jpeg|png|webp)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, TXT, MD, and images (JPG, PNG, WebP) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper to parse JSON from AI response
function parseJSON(response) {
  try {
    const codeBlockMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('No valid JSON found');
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}

// Helper to analyze document and extract exercises + metadata
async function analyzeDocument(filePath, mimeType) {
  try {
    // Process document to extract text
    const processedDoc = await contentService.processDocument(filePath, mimeType);
    
    if (!processedDoc.success) {
      throw new Error(processedDoc.error || 'Failed to process document');
    }
    
    // Use AI to analyze the content
    const analysisPrompt = `Analyze this document and extract information about the exercises.

DOCUMENT CONTENT:
${processedDoc.content.substring(0, 8000)}

Please analyze this document and return ONLY valid JSON in this format:
{
  "subject": "The subject of the exercises (e.g., English, Mathematics, Science, History, Chinese)",
  "concept": "The specific grammar point, concept, or skill being practiced (e.g., 'past tense', 'fractions', 'photosynthesis')",
  "difficulty": "easy|medium|hard",
  "extractedExercises": [
    {
      "type": "fill_blank|multiple_choice|match|error_correction|unscramble|short_answer",
      "text": "The question text",
      "answer": "The correct answer"
    }
  ],
  "exerciseCount": 5,
  "suggestedQuestionCount": 10
}

Instructions:
1. Identify the subject area from the content
2. Identify the specific concept or grammar point being tested
3. Extract as many exercises as you can find in the document
4. Determine the difficulty level based on the content complexity
5. Suggest how many similar exercises would be appropriate to generate

Return ONLY valid JSON, no markdown, no explanations.`;

    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: analysisPrompt }],
      { maxTokens: 2500, temperature: 0.3 }
    );
    
    const analysis = parseJSON(response);
    
    return {
      success: true,
      ...analysis,
      rawContent: processedDoc.content,
      title: processedDoc.title
    };
    
  } catch (error) {
    console.error('Document analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// ANALYZE DOCUMENT ENDPOINT (for similar mode)
// ============================================
router.post('/analyze-document', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }
    
    console.log(`📄 Analyzing document: ${req.file.originalname}`);
    
    const analysis = await analyzeDocument(req.file.path, req.file.mimetype);
    
    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});
    
    if (!analysis.success) {
      return res.status(400).json({
        success: false,
        message: analysis.error || 'Failed to analyze document'
      });
    }
    
    res.json({
      success: true,
      subject: analysis.subject,
      concept: analysis.concept,
      difficulty: analysis.difficulty,
      extractedExercises: analysis.extractedExercises || [],
      exerciseCount: analysis.exerciseCount || 0,
      suggestedQuestionCount: analysis.suggestedQuestionCount || 10
    });
    
  } catch (error) {
    console.error('Analyze document error:', error);
    
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to analyze document'
    });
  }
});

// ============================================
// GENERATE EXERCISES - Original Mode
// ============================================
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { subject, concept, numExercises = 10, difficulty = 'medium' } = req.body;
    
    // Validate input - only subject and concept are required
    if (!subject || !concept) {
      return res.status(400).json({
        success: false,
        message: 'Subject and concept are required'
      });
    }
    
    console.log(`📝 Generating ${numExercises} ${difficulty} exercises for ${subject}: ${concept}`);
    
    const prompt = `Create a printable worksheet with ${numExercises} exercises for Hong Kong secondary students (Form 1-3, age 12-15).

WORKSHEET DETAILS:
- Subject: ${subject}
- Grammar/Concept Focus: ${concept}
- Difficulty: ${difficulty} (easy=basic recall, medium=understanding, hard=application/analysis)
- Number of Questions: ${numExercises}

REQUIREMENTS:
1. Focus on practicing "${concept}" - this is the main learning objective
2. Use age-appropriate examples and contexts familiar to Hong Kong students
3. Mix of question types (distribute evenly):
   - fill_blank: Fill in the blanks (30%)
   - multiple_choice: Choose the correct answer (30%)
   - match: Match items from two columns (15%)
   - error_correction: Find and correct the error (15%)
   - unscramble: Rearrange words to form correct sentences (10%)

DIFFICULTY GUIDE:
- Easy: Direct recall, clear hints, simple sentences
- Medium: Understanding required, some inference needed
- Hard: Application, analysis, combining multiple concepts

EXAMPLE OUTPUT FORMAT:
{
  "title": "English Grammar: There Was/Were Practice",
  "subject": "English",
  "concept": "there was/were",
  "difficulty": "medium",
  "questions": [
    {
      "type": "fill_blank",
      "question": "Fill in the blanks with 'was' or 'were':",
      "items": [
        {"sentence": "______ there many students in the classroom yesterday?"},
        {"sentence": "______ there a teacher at the front?"}
      ],
      "answer": "Were, Was"
    },
    {
      "type": "multiple_choice",
      "question": "Choose the correct sentence:",
      "choices": [
        "There was many books on the shelf",
        "There were many books on the shelf",
        "There is many books on the shelf"
      ],
      "answer": "B"
    },
    {
      "type": "match",
      "question": "Match the items:",
      "columnA": ["Singular subject", "Plural subject", "Past tense"],
      "columnB": ["Use 'was'", "Use 'were'", "Already happened"],
      "answer": "1-A, 2-B, 3-C"
    },
    {
      "type": "error_correction",
      "question": "Find and correct the error:",
      "sentence": "There was many students in the hall.",
      "answer": "There were many students in the hall."
    },
    {
      "type": "unscramble",
      "question": "Rearrange the words to form a correct sentence:",
      "words": ["were", "there", "in", "chairs", "many", "the", "room"],
      "answer": "There were many chairs in the room."
    }
  ]
}

RULES:
1. ALL questions must practice ${concept} specifically
2. Make questions age-appropriate for 12-15 year olds
3. Use contexts familiar to Hong Kong students (school, family, daily life, local culture)
4. Include interesting examples to make learning engaging
5. Ensure answers are clear and unambiguous
6. For multiple choice: 4 options (A, B, C, D), only 1 correct
7. For matching: 3-5 items per column
8. For fill_blank: 3-5 items per question

Return ONLY valid JSON. No markdown, no explanations.`;

    // Call Kimi API
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }],
      { maxTokens: 2500, temperature: 0.7 }
    );
    
    // Parse response
    let exercises = parseJSON(response);
    
    // If parsing failed or incomplete, use fallback
    if (!exercises || !exercises.questions || exercises.questions.length < 3) {
      console.log('⚠️ Using fallback exercise generator');
      exercises = generateFallbackExercises(subject, concept, numExercises, difficulty);
    }
    
    // Ensure we have the right number of questions
    if (exercises.questions.length > numExercises) {
      exercises.questions = exercises.questions.slice(0, numExercises);
    }
    
    // Add metadata if missing
    exercises.subject = exercises.subject || subject;
    exercises.concept = exercises.concept || concept;
    exercises.difficulty = exercises.difficulty || difficulty;
    
    if (!exercises.title) {
      exercises.title = `${subject}: ${concept} Practice`;
    }
    
    console.log(`✅ Generated ${exercises.questions.length} exercises`);
    
    res.json({
      success: true,
      ...exercises,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Exercise generation error:', error);
    
    // Return fallback on error
    const fallback = generateFallbackExercises(
      req.body.subject,
      req.body.concept,
      req.body.numExercises || 10,
      req.body.difficulty || 'medium'
    );
    
    res.json({
      success: true,
      ...fallback,
      generatedAt: new Date().toISOString(),
      note: 'Using fallback exercises due to generation error'
    });
  }
});

// ============================================
// GENERATE SIMILAR EXERCISES - With File Upload
// ============================================
router.post('/generate-similar', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const { 
      subject, 
      concept, 
      numExercises = 10, 
      difficulty = 'medium',
      preservePattern = 'true'
    } = req.body;
    
    let referenceExercises = [];
    let detectedSubject = subject;
    let detectedConcept = concept;
    let detectedDifficulty = difficulty;
    
    // If file uploaded, analyze it
    if (req.file) {
      console.log(`📄 Processing uploaded document: ${req.file.originalname}`);
      
      const analysis = await analyzeDocument(req.file.path, req.file.mimetype);
      
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      
      if (!analysis.success) {
        return res.status(400).json({
          success: false,
          message: analysis.error || 'Failed to analyze document'
        });
      }
      
      // Use detected values if not provided by user
      referenceExercises = analysis.extractedExercises || [];
      detectedSubject = subject || analysis.subject;
      detectedConcept = concept || analysis.concept;
      detectedDifficulty = difficulty || analysis.difficulty;
      
      console.log(`📊 Detected: ${detectedSubject} - ${detectedConcept} (${referenceExercises.length} exercises found)`);
    }
    
    // Also check for referenceExercises in body (from text input)
    if (req.body.referenceExercises) {
      try {
        const parsed = JSON.parse(req.body.referenceExercises);
        if (Array.isArray(parsed) && parsed.length > 0) {
          referenceExercises = parsed;
        }
      } catch (e) {
        // Ignore parse error
      }
    }
    
    // Validate that we have reference exercises
    if (referenceExercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No reference exercises found. Please upload a document or provide reference exercises.'
      });
    }
    
    // Validate subject and concept (can be auto-detected from file)
    if (!detectedSubject || !detectedConcept) {
      return res.status(400).json({
        success: false,
        message: 'Subject and concept could not be determined. Please provide them manually.'
      });
    }
    
    console.log(`📝 Generating ${numExercises} similar exercises for ${detectedSubject}: ${detectedConcept}`);
    console.log(`📚 Based on ${referenceExercises.length} reference exercises`);
    
    // Format reference exercises for the prompt
    const referenceText = referenceExercises.map((ex, idx) => `
EXAMPLE ${idx + 1}:
Question: ${ex.text || ex.question || 'N/A'}
Type: ${ex.type || 'unknown'}
Answer: ${ex.answer || ex.correctAnswer || 'N/A'}
`).join('\n---\n');

    const prompt = `Create a printable worksheet with ${numExercises} exercises for Hong Kong secondary students (Form 1-3, age 12-15).

WORKSHEET DETAILS:
- Subject: ${detectedSubject}
- Grammar/Concept Focus: ${detectedConcept}
- Difficulty: ${detectedDifficulty}
- Number of Questions: ${numExercises}

REFERENCE EXERCISES (Analyze these and create similar ones):
${referenceText}

INSTRUCTIONS FOR GENERATING SIMILAR EXERCISES:
1. Analyze the pattern, style, and structure of the reference exercises above
2. Create NEW exercises that follow the SAME patterns but with DIFFERENT content
3. Maintain the same question types (fill_blank, multiple_choice, match, etc.)
4. Use similar difficulty level and vocabulary
5. Keep the same format and layout style
${preservePattern === 'true' ? '6. STRICTLY preserve the exact pattern from reference exercises' : '6. You may vary the patterns while keeping the concept focus'}

REQUIREMENTS:
- ALL questions must practice "${detectedConcept}" specifically
- Use contexts familiar to Hong Kong students (school, family, daily life)
- Ensure answers are clear and unambiguous
- For multiple choice: 4 options (A, B, C, D), only 1 correct
- For matching: 3-5 items per column
- For fill_blank: 3-5 items per question

OUTPUT FORMAT:
{
  "title": "${detectedSubject}: ${detectedConcept} Practice (Similar Exercises)",
  "subject": "${detectedSubject}",
  "concept": "${detectedConcept}",
  "difficulty": "${detectedDifficulty}",
  "questions": [
    {
      "type": "fill_blank | multiple_choice | match | error_correction | unscramble | short_answer",
      "question": "The question text",
      "items": [{"sentence": "..."}], // for fill_blank
      "choices": ["A", "B", "C", "D"], // for multiple_choice
      "columnA": ["..."], "columnB": ["..."], // for match
      "sentence": "...", // for error_correction
      "words": ["..."], // for unscramble
      "answer": "The correct answer"
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanations.`;

    // Call Kimi API
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }],
      { maxTokens: 3000, temperature: 0.6 }
    );
    
    // Parse response
    let exercises = parseJSON(response);
    
    // If parsing failed or incomplete, use fallback
    if (!exercises || !exercises.questions || exercises.questions.length < 3) {
      console.log('⚠️ Using fallback similar exercise generator');
      exercises = generateSimilarFallbackExercises(detectedSubject, detectedConcept, referenceExercises, numExercises, detectedDifficulty);
    }
    
    // Ensure we have the right number of questions
    if (exercises.questions.length > numExercises) {
      exercises.questions = exercises.questions.slice(0, numExercises);
    }
    
    // Add metadata
    exercises.subject = exercises.subject || detectedSubject;
    exercises.concept = exercises.concept || detectedConcept;
    exercises.difficulty = exercises.difficulty || detectedDifficulty;
    exercises.basedOn = referenceExercises.length;
    exercises.autoDetected = !subject || !concept; // Flag if values were auto-detected
    
    if (!exercises.title) {
      exercises.title = `${detectedSubject}: ${detectedConcept} Practice (Similar Exercises)`;
    }
    
    console.log(`✅ Generated ${exercises.questions.length} similar exercises`);
    
    res.json({
      success: true,
      ...exercises,
      detectedSubject,
      detectedConcept,
      detectedDifficulty,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Similar exercise generation error:', error);
    
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate similar exercises'
    });
  }
});

// ============================================
// FALLBACK GENERATORS
// ============================================

function generateFallbackExercises(subject, concept, numExercises, difficulty) {
  const title = `${subject}: ${concept} Practice`;
  const questions = [];
  const count = Math.min(Math.max(numExercises, 5), 20);
  
  const types = ['fill_blank', 'fill_blank', 'fill_blank', 
                 'multiple_choice', 'multiple_choice', 'multiple_choice',
                 'match', 'error_correction', 'unscramble', 'short_answer'];
  
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    
    switch (type) {
      case 'fill_blank':
        questions.push({
          type: 'fill_blank',
          question: `Fill in the blanks with the correct form of "${concept}":`,
          items: [
            { sentence: `______ example 1 using ${concept}.` },
            { sentence: `______ example 2 using ${concept}.` },
            { sentence: `______ example 3 using ${concept}.` }
          ],
          answer: "Correct, answers, here"
        });
        break;
        
      case 'multiple_choice':
        questions.push({
          type: 'multiple_choice',
          question: `Which sentence uses "${concept}" correctly?`,
          choices: [
            `Incorrect example A`,
            `Correct example using ${concept}`,
            `Incorrect example B`,
            `Incorrect example C`
          ],
          answer: "B"
        });
        break;
        
      case 'match':
        questions.push({
          type: 'match',
          question: `Match the items related to ${concept}:`,
          columnA: [`Concept aspect 1`, `Concept aspect 2`, `Concept aspect 3`],
          columnB: [`Description A`, `Description B`, `Description C`],
          answer: "1-A, 2-B, 3-C"
        });
        break;
        
      case 'error_correction':
        questions.push({
          type: 'error_correction',
          question: `Find and correct the error:`,
          sentence: `This sentence has an error with ${concept}.`,
          answer: `Corrected sentence using ${concept} properly.`
        });
        break;
        
      case 'unscramble':
        questions.push({
          type: 'unscramble',
          question: `Rearrange these words to make a correct sentence:`,
          words: ['words', 'to', 'unscramble', 'using', concept.toLowerCase()],
          answer: `Correct sentence using ${concept}.`
        });
        break;
        
      default:
        questions.push({
          type: 'short_answer',
          question: `Write a sentence using "${concept}" correctly:`,
          answer: `Example answer using ${concept}.`
        });
    }
  }
  
  return {
    title,
    subject,
    concept,
    difficulty,
    questions: questions.slice(0, count)
  };
}

function generateSimilarFallbackExercises(subject, concept, referenceExercises, numExercises, difficulty) {
  const title = `${subject}: ${concept} Practice (Similar Exercises)`;
  const questions = [];
  const count = Math.min(Math.max(numExercises, 5), 20);
  
  const patterns = referenceExercises.slice(0, 5).map(ex => ({
    type: ex.type || 'short_answer',
    hasItems: !!ex.items,
    hasChoices: !!ex.choices,
    hasColumnA: !!ex.columnA,
    hasSentence: !!ex.sentence,
    hasWords: !!ex.words
  }));
  
  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length] || { type: 'short_answer' };
    
    switch (pattern.type) {
      case 'fill_blank':
        questions.push({
          type: 'fill_blank',
          question: `Fill in the blanks with the correct form of "${concept}":`,
          items: [
            { sentence: `______ (Question ${i + 1}a) using ${concept}.` },
            { sentence: `______ (Question ${i + 1}b) using ${concept}.` },
            { sentence: `______ (Question ${i + 1}c) using ${concept}.` }
          ],
          answer: `Answer ${i + 1}a, Answer ${i + 1}b, Answer ${i + 1}c`
        });
        break;
        
      case 'multiple_choice':
        questions.push({
          type: 'multiple_choice',
          question: `Question ${i + 1}: Which uses "${concept}" correctly?`,
          choices: [
            `Option A for question ${i + 1}`,
            `Option B for question ${i + 1}`,
            `Option C for question ${i + 1}`,
            `Option D for question ${i + 1}`
          ],
          answer: "B"
        });
        break;
        
      case 'match':
        questions.push({
          type: 'match',
          question: `Question ${i + 1}: Match the items:`,
          columnA: [`Item A${i + 1}-1`, `Item A${i + 1}-2`, `Item A${i + 1}-3`],
          columnB: [`Item B${i + 1}-1`, `Item B${i + 1}-2`, `Item B${i + 1}-3`],
          answer: "1-1, 2-2, 3-3"
        });
        break;
        
      case 'error_correction':
        questions.push({
          type: 'error_correction',
          question: `Question ${i + 1}: Find and correct the error:`,
          sentence: `This is sentence ${i + 1} with an error in ${concept}.`,
          answer: `This is the corrected sentence ${i + 1} with proper ${concept}.`
        });
        break;
        
      case 'unscramble':
        questions.push({
          type: 'unscramble',
          question: `Question ${i + 1}: Rearrange these words:`,
          words: [`word${i + 1}a`, `word${i + 1}b`, `word${i + 1}c`, concept.toLowerCase()],
          answer: `Correct sentence ${i + 1} using ${concept}.`
        });
        break;
        
      default:
        questions.push({
          type: 'short_answer',
          question: `Question ${i + 1}: Explain or demonstrate "${concept}":`,
          answer: `Sample answer for question ${i + 1} about ${concept}.`
        });
    }
  }
  
  return {
    title,
    subject,
    concept,
    difficulty,
    basedOn: referenceExercises.length,
    questions: questions.slice(0, count)
  };
}

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Exercise generator is working' });
});

module.exports = router;
