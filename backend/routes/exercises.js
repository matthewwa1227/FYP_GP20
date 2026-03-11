const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');

// ============================================
// EXERCISE GENERATOR - Printable Worksheets
// ============================================

// Helper to parse JSON from AI response
function parseJSON(response) {
  try {
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    
    // Try to find JSON object
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

// Generate exercises endpoint
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { subject, topic, concept, numExercises = 10, difficulty = 'medium' } = req.body;
    
    // Validate input
    if (!subject || !topic || !concept) {
      return res.status(400).json({
        success: false,
        message: 'Subject, topic, and concept are required'
      });
    }
    
    console.log(`📝 Generating ${numExercises} ${difficulty} exercises for ${subject}: ${topic} (${concept})`);
    
    const prompt = `Create a printable worksheet with ${numExercises} exercises for Hong Kong secondary students (Form 1-3, age 12-15).

WORKSHEET DETAILS:
- Subject: ${subject}
- Topic/Theme: ${topic}
- Grammar/Concept Focus: ${concept}
- Difficulty: ${difficulty} (easy=basic recall, medium=understanding, hard=application/analysis)
- Number of Questions: ${numExercises}

REQUIREMENTS:
1. Questions must be contextually about "${topic}" - use ${topic}-specific examples and scenarios
2. Focus on practicing "${concept}" - this is the main learning objective
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
  "title": "Hong Kong History: There Was/Were Practice",
  "subject": "English",
  "topic": "Hong Kong History",
  "concept": "there was/were",
  "difficulty": "medium",
  "questions": [
    {
      "type": "fill_blank",
      "question": "Fill in the blanks with 'was' or 'were':",
      "items": [
        {"sentence": "______ there many fishing villages in Hong Kong 200 years ago?"},
        {"sentence": "______ there a British governor in 1841?"}
      ],
      "answer": "Were, Was"
    },
    {
      "type": "multiple_choice",
      "question": "Choose the correct sentence about Hong Kong's past:",
      "choices": [
        "There was many traders in the 19th century",
        "There were many traders in the 19th century",
        "There is many traders in the 19th century"
      ],
      "answer": "B"
    },
    {
      "type": "match",
      "question": "Match the historical periods with their characteristics:",
      "columnA": ["1841", "1898", "1997"],
      "columnB": ["New Territories leased", "Handover to China", "British colonial rule began"],
      "answer": "1-C, 2-A, 3-B"
    },
    {
      "type": "error_correction",
      "question": "Find and correct the error in this sentence about Hong Kong:",
      "sentence": "There was many ships in Victoria Harbour during the 1950s.",
      "answer": "There were many ships in Victoria Harbour during the 1950s."
    },
    {
      "type": "unscramble",
      "question": "Rearrange the words to form a correct sentence about Hong Kong's history:",
      "words": ["were", "there", "in", "fishermen", "many", "Stanley", "1841"],
      "answer": "There were many fishermen in Stanley in 1841."
    }
  ]
}

RULES:
1. ALL questions must use ${topic} context (names, places, facts from ${topic})
2. ALL questions must practice ${concept} specifically
3. Make questions age-appropriate for 12-15 year olds
4. Include interesting ${topic} facts to make learning engaging
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
      exercises = generateFallbackExercises(subject, topic, concept, numExercises, difficulty);
    }
    
    // Ensure we have the right number of questions
    if (exercises.questions.length > numExercises) {
      exercises.questions = exercises.questions.slice(0, numExercises);
    }
    
    // Add metadata if missing
    exercises.subject = exercises.subject || subject;
    exercises.topic = exercises.topic || topic;
    exercises.concept = exercises.concept || concept;
    exercises.difficulty = exercises.difficulty || difficulty;
    
    if (!exercises.title) {
      exercises.title = `${topic}: ${concept} Practice`;
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
      req.body.topic,
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

// Fallback exercise generator
function generateFallbackExercises(subject, topic, concept, numExercises, difficulty) {
  const title = `${topic}: ${concept} Practice`;
  const questions = [];
  
  // Generate appropriate number of questions
  const count = Math.min(Math.max(numExercises, 5), 20);
  
  // Question type distribution
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
            { sentence: `______ example 1 about ${topic}.` },
            { sentence: `______ example 2 about ${topic}.` },
            { sentence: `______ example 3 about ${topic}.` }
          ],
          answer: "Correct, answers, here"
        });
        break;
        
      case 'multiple_choice':
        questions.push({
          type: 'multiple_choice',
          question: `Which sentence uses "${concept}" correctly about ${topic}?`,
          choices: [
            `Incorrect example A about ${topic}`,
            `Correct example about ${topic} using ${concept}`,
            `Incorrect example B about ${topic}`,
            `Incorrect example C about ${topic}`
          ],
          answer: "B"
        });
        break;
        
      case 'match':
        questions.push({
          type: 'match',
          question: `Match the ${topic} items with their descriptions:`,
          columnA: [`Item 1 about ${topic}`, `Item 2 about ${topic}`, `Item 3 about ${topic}`],
          columnB: [`Description A`, `Description B`, `Description C`],
          answer: "1-A, 2-B, 3-C"
        });
        break;
        
      case 'error_correction':
        questions.push({
          type: 'error_correction',
          question: `Find and correct the error in this sentence about ${topic}:`,
          sentence: `This sentence about ${topic} has an error with ${concept}.`,
          answer: `Corrected sentence about ${topic} using ${concept} properly.`
        });
        break;
        
      case 'unscramble':
        questions.push({
          type: 'unscramble',
          question: `Rearrange these words to make a correct sentence about ${topic}:`,
          words: ['words', 'to', 'unscramble', 'about', topic.toLowerCase()],
          answer: `Correct sentence about ${topic}.`
        });
        break;
        
      default:
        questions.push({
          type: 'short_answer',
          question: `Write a sentence about ${topic} using "${concept}" correctly:`,
          answer: `Example answer using ${concept} about ${topic}.`
        });
    }
  }
  
  return {
    title,
    subject,
    topic,
    concept,
    difficulty,
    questions: questions.slice(0, count)
  };
}

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Exercise generator is working' });
});

module.exports = router;
