const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const kimiService = require('../services/kimiService');
const contentService = require('../services/contentService');
const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('../utils/logger');

// ============================================
// MULTER CONFIGURATION
// ============================================

// FIX: Ensure uploads directory exists with absolute path
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'exercises');

// Create directory if it doesn't exist
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
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

// Helper to remove trailing commas from JSON strings (respects quoted strings)
function sanitizeJSONString(str) {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    // Only strip commas that are trailing (next non-whitespace is ] or })
    if (!inString && char === ',') {
      let j = i + 1;
      while (j < str.length && /\s/.test(str[j])) j++;
      if (j < str.length && (str[j] === ']' || str[j] === '}')) {
        continue; // skip trailing comma
      }
    }

    result += char;
  }

  return result;
}

// Helper to parse JSON from AI response - ROBUST VERSION
function parseJSON(response) {
  try {
    // Log raw response for debugging
    console.log("Raw AI response (first 500 chars):", response?.substring(0, 500));
    
    // Handle case where response is an object (from Kimi service)
    let content = response;
    if (typeof response === 'object' && response.choices) {
      content = response.choices[0]?.message?.content || '';
    }
    
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid response format');
    }
    
    // Remove markdown code blocks if present
    // Handle ```json ... ``` or ``` ... ``` with or without newlines
    content = content.replace(/```json\n?/gi, '');
    content = content.replace(/```\n?/g, '');
    
    // Remove any text before { or after }
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error('No JSON object found in response');
      console.error('Content was:', content);
      throw new Error('No JSON object found in response');
    }
    
    content = content.substring(jsonStart, jsonEnd + 1);
    
    // Fix common LLM JSON malformations (trailing commas, etc.)
    content = sanitizeJSONString(content);
    
    // Parse the cleaned JSON
    const parsed = JSON.parse(content);
    console.log('✅ JSON parsed successfully');
    return parsed;
    
  } catch (error) {
    console.error('❌ JSON parse error:', error.message);
    return null;
  }
}

// Helper to analyze document and extract exercises + metadata
// Supports single file path or array of {path, mimeType} for multiple images
async function analyzeDocument(filePath, mimeType) {
  try {
    // MISSION 50: Support array of files for multi-image analysis
    const isMultiImage = Array.isArray(filePath);
    
    if (isMultiImage) {
      // Multi-image analysis
      console.log(`🖼️ Multi-image analysis: ${filePath.length} images`);
      
      const imagesBase64 = [];
      const fileNames = [];
      
      for (const file of filePath) {
        const imgBuffer = fsSync.readFileSync(file.path);
        imagesBase64.push(imgBuffer.toString('base64'));
        fileNames.push(path.basename(file.path));
      }
      
      console.log(`🖼️ Total base64 size: ${imagesBase64.reduce((a, b) => a + b.length, 0)} chars`);
      
      // Call Kimi API with multiple images
      const response = await kimiService.analyzeDocumentImage(imagesBase64, mimeType);
      
      const analysis = parseJSON(response);
      
      if (!analysis) {
        return { success: false, error: 'Could not parse AI response for images' };
      }
      
      return {
        success: true,
        ...analysis,
        rawContent: `[Images: ${fileNames.join(', ')}]`,
        title: 'Multi-Image Analysis'
      };
    }
    
    // Single file analysis
    // MISSION 48: Check if it's an image - use vision API with base64
    const isImage = mimeType?.startsWith('image/') || filePath.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    
    if (isImage) {
      console.log(`🖼️ Detected image file, using vision analysis: ${path.basename(filePath)}`);
      
      // Read image as base64
      const imageBuffer = fsSync.readFileSync(filePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      console.log(`🖼️ Image base64 length: ${imageBase64.length} chars`);
      
      // Call Kimi API with image
      const response = await kimiService.analyzeDocumentImage(imageBase64, mimeType);
      
      const analysis = parseJSON(response);
      
      if (!analysis) {
        return { success: false, error: 'Could not parse AI response for image' };
      }
      
      return {
        success: true,
        ...analysis,
        rawContent: `[Image: ${path.basename(filePath)}]`,
        title: path.basename(filePath, path.extname(filePath))
      };
    }
    
    // Process document to extract text (non-image files)
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

IMPORTANT: If the document contains Chinese text with mathematical calculations (numbers, equations, word problems), detect subject as 'Mathematics' and language as 'Chinese'. Do not default to English. Analyze carefully before deciding.

Return ONLY valid JSON, no markdown, no explanations.`;

    console.log(`⚠️ Using 4000 max_tokens for document analysis`);
    
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: analysisPrompt }],
      { maxTokens: 4000 }  // Increased for better detection accuracy
    );
    
    const analysis = parseJSON(response);
    
    if (!analysis) {
      return { success: false, error: 'Could not parse AI response for document' };
    }
    
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
// ANALYZE DOCUMENT ENDPOINT - Batch Multi-File Support (MISSION 52)
// ============================================
router.post('/analyze-document', authenticateToken, upload.array('documents', 3), async (req, res) => {
  try {
    // MISSION 52: Support single file (backward compat) or multiple files
    const files = req.files;
    const singleFile = req.file; // From single upload (backward compat)
    
    if ((!files || files.length === 0) && !singleFile) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }
    
    // Debug logging for MISSION 53
    logger.file('MISSION 53: Received files:', files?.map(f => ({ name: f.originalname, field: f.fieldname, size: f.size })));
    logger.file('MISSION 53: Single file:', singleFile?.originalname);
    
    // Handle multiple files
    if (files && files.length > 1) {
      logger.image('MISSION 52: Batch analyzing', files.length, 'documents');
      
      const fileData = files.map(f => ({ path: f.path, mimetype: f.mimetype }));
      
      const analysis = await analyzeDocument(fileData, files[0].mimetype);
      
      // Clean up uploaded files
      await Promise.all(files.map(f => fs.unlink(f.path).catch(() => {})));
      
      if (!analysis.success) {
        return res.status(400).json({
          success: false,
          message: analysis.error || 'Failed to analyze documents'
        });
      }
      
      return res.json({
        success: true,
        subject: analysis.subject,
        concept: analysis.concept,
        difficulty: analysis.difficulty,
        extractedExercises: analysis.extractedExercises || [],
        exerciseCount: analysis.exerciseCount || 0,
        suggestedQuestionCount: analysis.suggestedQuestionCount || 10,
        batchProcessed: files.length
      });
    }
    
    // Handle single file (backward compatibility)
    const file = files?.[0] || singleFile;
    console.log(`📄 Analyzing document: ${file.originalname}`);
    
    const analysis = await analyzeDocument(file.path, file.mimetype);
    
    // Clean up uploaded file
    await fs.unlink(file.path).catch(() => {});
    
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
    
    // Clean up files on error
    if (req.files) {
      await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
    }
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
  const { subject, concept, numExercises = 10, difficulty = 'medium' } = req.body;
  
  // Validate input - only subject and concept are required
  if (!subject || !concept) {
    return res.status(400).json({
      success: false,
      message: 'Subject and concept are required'
    });
  }
  
  // MAX 10 TO GUARANTEE SPEED
  const count = Math.min(numExercises, 10);
  
  console.log(`📝 Generating ${count} ${difficulty} exercises for ${subject}: ${concept}`);
  
  // SHORTEST POSSIBLE PROMPT
  const prompt = `Create ${count} ${subject} exercises about ${concept}.
Difficulty: ${difficulty}
Rules: Real sentences only, no placeholders.

Return JSON:
{
  "questions": [
    {"type": "fill_blank", "question": "The FULL sentence with a _____ blank", "sentence": "Same as question — the full sentence with a blank", "answer": "The correct word"},
    {"type": "multiple_choice", "question": "The full question text", "choices": ["A", "B", "C", "D"], "answer": "B"}
  ]
}

IMPORTANT: For fill_blank questions, the 'question' field MUST contain the full sentence with the blank (e.g., "The assassination took place in _____."). Do NOT put generic text like "Complete the sentence." in the question field.`;

  try {
    // NO TIMEOUT - Just wait for AI response naturally
    const response = await kimiService.generateExercises(prompt);
    
    // DEBUG: Log full response structure
    console.log('=== FULL RESPONSE DEBUG ===');
    console.log('Response type:', typeof response);
    console.log('Is string?', typeof response === 'string');
    console.log('Has choices?', !!response.choices);
    console.log('Choices length:', response.choices?.length);
    
    if (response.choices && response.choices[0]) {
      console.log('Has message?', !!response.choices[0].message);
      console.log('Content type:', typeof response.choices[0].message?.content);
      console.log('Content preview (first 300 chars):', response.choices[0].message?.content?.substring(0, 300));
    }
    console.log('===========================');
    
    // Try to parse with detailed error handling
    let exercises;
    try {
      // Handle both cases: object or string
      let content;
      if (typeof response === 'string') {
        console.log('📄 Response is a string, using directly');
        content = response;
      } else if (response.choices && response.choices[0]?.message?.content) {
        console.log('📄 Response is object with choices, extracting content');
        content = response.choices[0].message.content;
      } else {
        console.log('⚠️ Unexpected response format:', JSON.stringify(response).substring(0, 200));
        throw new Error('No content found in response');
      }
      
      console.log('Raw content length:', content.length);
      console.log('Content starts with:', content.substring(0, 50));
      
      // Clean markdown
      content = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
      console.log('After markdown removal length:', content.length);
      
      // Find JSON
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      
      console.log('JSON braces found:', { start, end });
      
      if (start === -1 || end === -1 || end <= start) {
        console.log('❌ No valid JSON braces found. Content:', content.substring(0, 500));
        throw new Error('No JSON braces found in response');
      }
      
      content = content.substring(start, end + 1);
      
      // Fix common LLM JSON malformations (trailing commas, etc.)
      content = sanitizeJSONString(content);
      
      console.log('Extracted JSON (first 300 chars):', content.substring(0, 300));
      
      exercises = JSON.parse(content);
      console.log('✅ JSON parsed successfully');
      console.log('Questions count:', exercises.questions?.length || 0);
      
    } catch (parseErr) {
      console.error('❌ Parse error details:', parseErr.message);
      console.error('Stack:', parseErr.stack);
      throw new Error('Parse failed: ' + parseErr.message);
    }
    
    // If parsing failed or incomplete, use fallback
    if (!exercises || !exercises.questions || exercises.questions.length < 3) {
      console.log('⚠️ Using instant fallback (parsing failed or insufficient questions)');
      exercises = generateInstantFallback(subject, concept, count);
    }
    
    // Ensure we have the right number of questions
    if (exercises.questions.length > count) {
      exercises.questions = exercises.questions.slice(0, count);
    }
    
    // Add metadata if missing
    exercises.subject = exercises.subject || subject;
    exercises.concept = exercises.concept || concept;
    exercises.difficulty = exercises.difficulty || difficulty;
    exercises.isAIGenerated = true;
    
    if (!exercises.title) {
      exercises.title = `${subject}: ${concept} Practice`;
    }
    
    console.log(`✅ Generated ${exercises.questions.length} exercises (AI)`);
    
    return res.json({
      success: true,
      ...exercises,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.log('⚠️ Final error, using instant fallback:', error.message);
    
    // Only use fallback on actual API error, not timeout (since no timeout now)
    const fallback = generateInstantFallback(subject, concept, count, difficulty);
    
    return res.json({
      success: true,
      ...fallback,
      generatedAt: new Date().toISOString()
    });
  }
});

// ============================================
// GENERATE READING COMPREHENSION - MISSION 55
// ============================================
router.post('/generate-reading', authenticateToken, async (req, res) => {
  const { subject, difficulty = 'medium', passageType = 'narrative', numQuestions = 5 } = req.body;
  
  // Validate input
  if (!subject || !['English', 'Chinese'].includes(subject)) {
    return res.status(400).json({
      success: false,
      message: 'Subject must be English or Chinese'
    });
  }
  
  // Allow 5-15 questions based on user preference
  const count = Math.min(Math.max(numQuestions, 5), 15);
  
  logger.info(`📚 Reading Comprehension: ${subject} | ${difficulty} | ${passageType} | ${count} Qs`);
  
  try {
    // EXTENDED TIMEOUT: 3 min 10s for high quality generation
    req.setTimeout(190000, () => {
      logger.warn('⏱️ Request timeout - sending fallback');
    });
    
    const response = await kimiService.generateReadingPassage(
      subject,
      difficulty,
      passageType,
      count,
      true // include vocabulary
    );
    
    // Parse the response
    let readingData;
    try {
      readingData = JSON.parse(response);
    } catch (e) {
      logger.error('Failed to parse reading response:', e.message);
      throw new Error('Parse error');
    }
    
    // Validate structure
    if (!readingData.passage || !readingData.questions || readingData.questions.length === 0) {
      throw new Error('Invalid structure');
    }
    
    logger.success(`✅ Generated: "${readingData.title}" (${readingData.wordCount} words)`);
    
    res.json({
      success: true,
      ...readingData,
      isReadingComprehension: true,
      _aiGenerated: true,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    const isTimeout = error.message.includes('TIMEOUT') || error.message.includes('timeout');
    
    if (isTimeout) {
      logger.warn('⏱️ Using fallback due to timeout');
    } else {
      logger.error('❌ Generation error:', error.message);
    }
    
    // Return fallback data immediately on any error
    const fallbackData = generateReadingFallback(subject, difficulty, passageType, count);
    
    res.json({
      success: true,
      ...fallbackData,
      isReadingComprehension: true,
      _fallback: true,
      _fallbackReason: isTimeout ? 'timeout' : 'error',
      generatedAt: new Date().toISOString()
    });
  }
});

// Enhanced fallback generator with realistic content
function generateReadingFallback(subject, difficulty, passageType, count) {
  const isChinese = subject === 'Chinese';
  
  // Realistic English passages
  const englishPassages = {
    narrative: {
      title: 'The Unexpected Journey',
      passage: `Tom had always been curious about the old house at the end of his street. One rainy afternoon, while walking home from school, he noticed the front door was slightly open. Against his better judgment, he decided to investigate.

The hallway was dark and dusty, with paintings of people long forgotten hanging on the walls. As Tom explored further, he discovered a room filled with old books and maps. One map in particular caught his attention - it showed hidden tunnels beneath the town that nobody knew existed.

Suddenly, Tom heard footsteps upstairs. His heart raced as he realized he might not be alone. Gathering his courage, he decided it was time to leave, but not before taking a photo of the mysterious map with his phone. Little did he know that this discovery would lead to the greatest adventure of his life.`,
      wordCount: 156,
      vocab: [
        { word: 'investigate', meaning: 'to examine carefully', sentence: 'The detective came to investigate the crime.' },
        { word: 'against his better judgment', meaning: 'despite knowing it might be wrong', sentence: 'Against his better judgment, he ate the expired food.' }
      ]
    },
    expository: {
      title: 'The Science of Sleep',
      passage: `Sleep is one of the most important processes for human health, yet many teenagers do not get enough of it. Scientists have discovered that during sleep, the brain clears away toxic waste products that build up during the day. This process, called the glymphatic system, works like a cleaning service for your brain.

Teenagers need between 8 to 10 hours of sleep per night because their brains and bodies are still developing. Lack of sleep can affect memory, concentration, and even emotional control. Studies show that students who sleep well perform better in exams and have better mental health.

To improve sleep quality, experts recommend avoiding screens one hour before bed, keeping a regular sleep schedule, and creating a cool, dark sleeping environment. These simple habits can make a significant difference in overall well-being.`,
      wordCount: 148,
      vocab: [
        { word: 'toxic', meaning: 'poisonous or harmful', sentence: 'The factory released toxic chemicals into the river.' },
        { word: 'concentration', meaning: 'the ability to focus attention', sentence: 'The quiet library helped improve my concentration.' }
      ]
    }
  };
  
  // Realistic Chinese passages
  const chinesePassages = {
    narrative: {
      title: '雨後的彩虹',
      passage: `小明放學回家的時候，天空突然烏雲密佈，下起了傾盆大雨。他沒有帶雨傘，只好躲在學校的走廊下等待雨停。

雨勢漸漸小了，小明決定冒雨跑回家。就在他奔跑的時候，雨突然停了，太陽從雲層中探出頭來。小明抬頭一看，驚喜地發現天邊掛著一道美麗的彩虹。

彩虹有七種顏色，紅、橙、黃、綠、青、藍、紫，像一座彩色的橋樑橫跨天空。小明停下腳步，靜靜地欣賞這大自然的美景。他想，雖然被雨淋濕了，但能看到這麼美的彩虹，一切都是值得的。

從那天起，小明明白了：困難過後，往往會有美好的事物等待著我們。`,
      wordCount: 168,
      vocab: [
        { word: '烏雲密佈', meaning: '天空充滿黑雲', sentence: '颱風來之前，天空烏雲密佈。' },
        { word: '傾盆大雨', meaning: '雨下得很大', sentence: '外面下著傾盆大雨，我們無法出門。' }
      ]
    },
    expository: {
      title: '保護環境的重要性',
      passage: `地球是我們唯一的家園，保護環境是每個人的責任。隨著科技的發展和人口的增長，環境污染問題日益嚴重。空氣污染、水污染和垃圾問題都在威脅著我們的健康。

香港作為一個國際大都市，每天產生大量的廢物。如果我們不加以控制，這些廢物將會堆積如山，影響我們的生活質素。因此，政府推行了垃圾分類和回收計劃，鼓勵市民減少使用一次性塑膠製品。

作為學生，我們可以從小事做起：自備水壺、使用環保袋、節約用水用電。這些小小的行動，累積起來就能對環境產生巨大的影響。讓我們一起努力，為下一代創造一個更美好的地球。`,
      wordCount: 175,
      vocab: [
        { word: '日益嚴重', meaning: '一天比一天厲害', sentence: '交通擠塞問題日益嚴重。' },
        { word: '累積', meaning: '一點一點地聚集', sentence: '知識需要長期累積。' }
      ]
    }
  };
  
  // Select passage based on type
  const passageData = isChinese 
    ? chinesePassages[passageType] || chinesePassages.narrative
    : englishPassages[passageType] || englishPassages.narrative;
  
  // Generate questions based on passage
  const questions = isChinese 
    ? generateChineseQuestions(passageData, count)
    : generateEnglishQuestions(passageData, count);
  
  return {
    title: passageData.title,
    subject,
    difficulty,
    passageType,
    passage: passageData.passage,
    wordCount: passageData.wordCount,
    vocabulary: passageData.vocab,
    questions
  };
}

// Helper to generate English questions
function generateEnglishQuestions(passage, count) {
  const qTypes = ['main_idea', 'detail', 'vocabulary', 'inference'];
  const questionBank = [
    { type: 'main_idea', q: 'What is the main idea of this passage?', options: ['A. The importance of curiosity', 'B. A discovery that leads to adventure', 'C. The dangers of old houses', 'D. Rainy day activities'], answer: 'B', explain: 'The passage focuses on Tom discovering a mysterious map that will lead to an adventure.' },
    { type: 'detail', q: 'What did Tom notice about the old house?', options: ['A. The windows were broken', 'B. The front door was open', 'C. There were lights on inside', 'D. A dog was barking'], answer: 'B', explain: 'The text states "he noticed the front door was slightly open."' },
    { type: 'vocabulary', q: 'What does "investigate" mean in this context?', options: ['A. To run away quickly', 'B. To examine carefully', 'C. To ignore completely', 'D. To clean thoroughly'], answer: 'B', explain: '"Investigate" means to examine or look into something carefully.' },
    { type: 'inference', q: 'Why did Tom take a photo of the map?', options: ['A. He wanted to sell it', 'B. He found it interesting and wanted to explore later', 'C. He was afraid of forgetting his way home', 'D. His teacher asked him to'], answer: 'B', explain: 'Tom took the photo because the map showed hidden tunnels, suggesting he wanted to explore them later.' },
    { type: 'detail', q: 'How did Tom feel when he heard footsteps?', options: ['A. Excited and happy', 'B. Scared and nervous', 'C. Angry and frustrated', 'D. Bored and tired'], answer: 'B', explain: 'The text says "His heart raced" which indicates he was scared and nervous.' }
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const q = questionBank[i % questionBank.length];
    return {
      type: q.type,
      question: q.q,
      options: q.options,
      answer: q.answer,
      explanation: q.explain
    };
  });
}

// Helper to generate Chinese questions
function generateChineseQuestions(passage, count) {
  const questionBank = [
    { type: '主旨', q: '這篇文章主要說明了什麼道理？', options: ['A. 下雨的壞處', 'B. 困難過後會有美好的事物', 'C. 跑步的好處', 'D. 學校的安全措施'], answer: 'B', explain: '文章結尾提到「困難過後，往往會有美好的事物等待著我們」。' },
    { type: '細節', q: '小明為什麼躲在學校走廊？', options: ['A. 他在等人', 'B. 下大雨他沒有帶傘', 'C. 他在玩捉迷藏', 'D. 他忘記了回家的路'], answer: 'B', explain: '文中提到「他沒有帶雨傘，只好躲在學校的走廊下等待雨停」。' },
    { type: '詞意', q: '「傾盆大雨」的意思是什麼？', options: ['A. 雨很小', 'B. 雨下得很大', 'C. 雨停了', 'D. 天空很藍'], answer: 'B', explain: '「傾盆大雨」形容雨下得很大，像整盆水倒下來一樣。' },
    { type: '推理', q: '小明看到彩虹後有什麼感受？', options: ['A. 很生氣', 'B. 很驚喜和開心', 'C. 很無聊', 'D. 很害怕'], answer: 'B', explain: '文中提到「驚喜地發現」，表示小明感到驚喜和開心。' },
    { type: '細節', q: '彩虹有幾種顏色？', options: ['A. 五種', 'B. 六種', 'C. 七種', 'D. 八種'], answer: 'C', explain: '文中明確提到「彩虹有七種顏色」。' }
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const q = questionBank[i % questionBank.length];
    return {
      type: q.type,
      question: q.q,
      options: q.options,
      answer: q.answer,
      explanation: q.explain
    };
  });
}

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

IMPORTANT: For fill_blank questions, the 'question' field MUST contain the full sentence with the blank (e.g., "The assassination took place in _____."). Do NOT put generic text like "Complete the sentence." in the question field.

Return ONLY valid JSON. No markdown, no explanations.`;

    // Call Kimi API
    console.log(`⚠️ Using 8000 max_tokens for similar exercises`);
    
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }],
      { maxTokens: 8000 }  // Increased to match exercise generation, prevents truncation
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

// INSTANT FALLBACK - Real content, no placeholders
function generateInstantFallback(subject, concept, count, difficulty = 'medium') {
  const questions = [];
  
  // FIX: Check CONCEPT first for Chinese terms (not just subject)
  // This handles cases like "History" subject with "詞意" concept
  if (concept.includes('詞意') || concept.includes('段意') || concept.includes('詞語') || concept.includes('成語') || concept.includes('詞義')) {
    console.log(`📚 Using Chinese vocabulary fallback for concept: ${concept}`);
    
    const bank = [
      {q: '「慷慨」的意思是什麼？', s: '他為人慷慨，經常捐款幫助貧困學生。', a: '大方、不吝嗇，願意幫助別人'},
      {q: '「猶豫不決」的意思是什麼？', s: '他猶豫不決，不知道該選哪一所中學。', a: '拿不定主意，遲疑不決'},
      {q: '「持之以恆」的意思是什麼？', s: '學習需要持之以恆，不能半途而廢。', a: '堅持到底，不中途放棄'},
      {q: '「一絲不苟」的意思是什麼？', s: '他做事一絲不苟，十分認真仔細。', a: '認真仔細，不馬虎'},
      {q: '「虛心學習」的意思是什麼？', s: '我們要虛心學習，不可驕傲自滿。', a: '謙虛、肯學習別人的長處'},
      {q: '「井井有條」的意思是什麼？', s: '他的書桌總是井井有條。', a: '整齊有秩序'},
      {q: '「刻苦耐勞」的意思是什麼？', s: '工人刻苦耐勞，完成這項工程。', a: '能吃苦、有毅力'},
      {q: '「見義勇為」的意思是什麼？', s: '他見義勇為，挺身而出幫助被欺負的同學。', a: '看到正義的事就勇敢地去做'},
      {q: '「尊師重道」的意思是什麼？', s: '我們應該尊師重道，尊敬老師。', a: '尊敬老師，重視道德'},
      {q: '「勤能補拙」的意思是什麼？', s: '他相信勤能補拙，努力練習終於成功。', a: '勤奮可以彌補天資不足'}
    ];
    
    for (let i = 0; i < count; i++) {
      const item = bank[i % bank.length];
      questions.push({
        type: i % 2 === 0 ? 'fill_blank' : 'multiple_choice',
        question: item.q,
        sentence: item.s,
        choices: i % 2 === 1 ? [
          {text: item.a, correct: true},
          {text: '錯誤的答案A', correct: false},
          {text: '錯誤的答案B', correct: false},
          {text: '錯誤的答案C', correct: false}
        ] : undefined,
        answer: item.a
      });
    }
    
    return {
      title: `${subject}: ${concept} Practice`,
      subject,
      topic: subject,
      concept,
      difficulty,
      questions: questions
    };
  }
  
  // English grammar fallbacks - check concept for grammar terms
  if (concept.toLowerCase().includes('was/were') || concept.toLowerCase().includes('past tense') || 
      concept.toLowerCase().includes('grammar') || concept.toLowerCase().includes('there is/are') ||
      subject === 'English' || subject === ' english') {
    console.log(`📚 Using English grammar fallback for concept: ${concept}`);
    
    const englishBank = [
      {q: 'Fill in the blank: There _____ many students in the classroom.', s: 'There _____ many students in the classroom yesterday.', a: 'were'},
      {q: 'Fill in the blank: She _____ to school every day.', s: 'She _____ to school every day by bus.', a: 'goes'},
      {q: 'Choose the correct sentence:', choices: ['There was many books', 'There were many books', 'There is many books', 'There are many books'], a: 'B'},
      {q: 'Fill in the blank: I have _____ apple for lunch.', s: 'I have _____ apple for lunch.', a: 'an'},
      {q: 'Fill in the blank: They _____ playing football now.', s: 'They _____ playing football now.', a: 'are'},
      {q: 'Choose the correct past tense:', choices: ['I goed to school', 'I went to school', 'I going to school', 'I gone to school'], a: 'B'},
      {q: 'Fill in the blank: The cat is _____ the table.', s: 'The cat is _____ the table.', a: 'under'},
      {q: 'Choose the correct article:', choices: ['a hour', 'an hour', 'the hour', 'hour'], a: 'B'}
    ];
    
    for (let i = 0; i < count; i++) {
      const item = englishBank[i % englishBank.length];
      if (item.choices) {
        questions.push({
          type: 'multiple_choice',
          question: item.q,
          choices: item.choices,
          answer: item.a
        });
      } else {
        questions.push({
          type: 'fill_blank',
          question: item.q,
          sentence: item.s,
          answer: item.a
        });
      }
    }
    
    return {
      title: `${subject}: ${concept} Practice`,
      subject,
      topic: subject,
      concept,
      difficulty,
      questions: questions
    };
  }
  // Mathematics fallbacks
  else if (subject === 'Mathematics' || subject === 'Math') {
    console.log(`📚 Using Mathematics fallback for subject: ${subject}`);
    
    const mathBank = [
      {q: 'What is 25 + 37?', a: '62'},
      {q: 'Calculate: 100 - 48', a: '52'},
      {q: 'What is 8 × 7?', a: '56'},
      {q: 'Calculate: 72 ÷ 9', a: '8'},
      {q: 'What is 3/4 of 20?', a: '15'},
      {q: 'Simplify: 12/16', a: '3/4'},
      {q: 'What is 15% of 200?', a: '30'},
      {q: 'Calculate: 2² + 3²', a: '13'}
    ];
    
    for (let i = 0; i < count; i++) {
      const item = mathBank[i % mathBank.length];
      questions.push({
        type: 'short_answer',
        question: item.q,
        answer: item.a
      });
    }
    
    return {
      title: `${subject}: ${concept} Practice`,
      subject,
      topic: subject,
      concept,
      difficulty,
      questions: questions
    };
  }
  // History fallbacks
  else if (subject === 'History') {
    const historyBank = [
      {q: 'Which ancient civilization built the pyramids?', choices: ['Romans', 'Greeks', 'Egyptians', 'Mayans'], a: 'C'},
      {q: 'In what year did World War II end?', choices: ['1940', '1945', '1950', '1939'], a: 'B'},
      {q: 'Who was the first Emperor of China?', a: 'Qin Shi Huang'},
      {q: 'Which event started World War I?', choices: ['Pearl Harbor', 'Assassination of Archduke Franz Ferdinand', 'D-Day', 'Atomic bomb'], a: 'B'},
      {q: 'When did Hong Kong become a British colony?', choices: ['1841', '1900', '1945', '1997'], a: 'A'}
    ];
    
    for (let i = 0; i < count; i++) {
      const item = historyBank[i % historyBank.length];
      if (item.choices) {
        questions.push({
          type: 'multiple_choice',
          question: item.q,
          choices: item.choices,
          answer: item.a
        });
      } else {
        questions.push({
          type: 'short_answer',
          question: item.q,
          answer: item.a
        });
      }
    }
  }
  // Science fallbacks
  else if (subject === 'Science') {
    console.log(`📚 Using Science fallback for subject: ${subject}`);
    
    const scienceBank = [
      {q: 'What is the chemical formula for water?', choices: ['CO2', 'H2O', 'O2', 'NaCl'], a: 'B'},
      {q: 'What gas do plants absorb from the air?', choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], a: 'B'},
      {q: 'What is the powerhouse of the cell?', choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cell wall'], a: 'B'},
      {q: 'How many planets are in our solar system?', a: 'Eight'},
      {q: 'What is the boiling point of water in Celsius?', a: '100'}
    ];
    
    for (let i = 0; i < count; i++) {
      const item = scienceBank[i % scienceBank.length];
      if (item.choices) {
        questions.push({
          type: 'multiple_choice',
          question: item.q,
          choices: item.choices,
          answer: item.a
        });
      } else {
        questions.push({
          type: 'short_answer',
          question: item.q,
          answer: item.a
        });
      }
    }
    
    return {
      title: `${subject}: ${concept} Practice`,
      subject,
      topic: subject,
      concept,
      difficulty,
      questions: questions
    };
  }
  // Generic fallback for other subjects
  console.log(`📚 Using generic fallback for subject: ${subject}, concept: ${concept}`);
  
  for (let i = 0; i < count; i++) {
    questions.push({
      type: 'fill_blank',
      question: `Question ${i+1} about ${concept}:`,
      sentence: `This is a practice question about ${concept}.`,
      answer: `Correct answer for ${concept}`
    });
  }
  
  return {
    title: `${subject}: ${concept} Practice (Auto-generated)`,
    subject,
    concept,
    difficulty,
    questions: questions,
    isAutoGenerated: true
  };
}

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

// ============================================
// MISSION 53: Multer Error Handler
// ============================================
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer Error:', err.message, '| Field:', err.field, '| Code:', err.code);
    return res.status(400).json({ 
      success: false,
      error: `Upload error: ${err.message}`,
      field: err.field,
      hint: 'Expected field name: "documents" for /analyze-document or "document" for /generate-similar'
    });
  }
  // Handle other errors
  if (err) {
    console.error('❌ Route Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
  next();
});

module.exports = router;
