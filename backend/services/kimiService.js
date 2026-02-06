// services/kimiService.js

const OpenAI = require('openai');

console.log('🔑 Kimi API Key loaded:', process.env.KIMI_API_KEY ? 'Yes (length: ' + process.env.KIMI_API_KEY.length + ')' : 'NO - MISSING!');

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
  timeout: 60000
});

// ============================================
// TIER-AWARE PROMPT HELPERS
// ============================================

const TIER_PROMPT_CONFIG = {
  'P1-P3': {
    label: 'Primary 1-3 (ages 6-8)',
    language: 'Use very simple English with short sentences (max 10-12 words each). Use basic vocabulary only. Be extremely encouraging and gentle.',
    contentDepth: 'Introduce ONE simple idea at a time. Use concrete, everyday examples (toys, food, animals, family). Avoid abstract reasoning.',
    questionStyle: 'Ask simple recall or identification questions. Wrong answers should be obviously wrong. Keep all answer text under 8 words each.',
    storyTone: 'Magical, friendly, and playful. Use cute characters and bright imagery. Lots of encouragement and celebration.',
    exampleContext: 'Hong Kong primary school life — MTR rides, dim sum, Ocean Park, school uniforms, red packets'
  },
  'P4-P6': {
    label: 'Primary 4-6 (ages 9-11)',
    language: 'Use clear, simple English with moderate sentence length. Introduce subject-specific vocabulary with brief definitions.',
    contentDepth: 'Explain concepts with relatable everyday examples. Include one simple analogy per lesson. Build on foundational knowledge.',
    questionStyle: 'Test understanding and simple application. Distractors should be plausible but distinguishable. Keep answers under 15 words each.',
    storyTone: 'Adventurous and exploratory. The player discovers knowledge through quests. Encourage curiosity and teamwork.',
    exampleContext: 'Hong Kong school projects, local geography (Victoria Harbour, Lion Rock), festivals, public transport systems'
  },
  'S1-S3': {
    label: 'Secondary 1-3 (ages 12-14)',
    language: 'Use standard academic English. Introduce proper terminology with clear explanations. Moderate complexity.',
    contentDepth: 'Explain principles and their connections. Include cause-and-effect reasoning. Use real-world applications relevant to Hong Kong.',
    questionStyle: 'Test application and analysis. Distractors should require careful thinking to eliminate. Include "why" and "how" questions.',
    storyTone: 'Mystery and investigation themed. The player solves problems using knowledge. Respectful and intellectually engaging.',
    exampleContext: 'Hong Kong current affairs, local industries, environmental issues, technology in daily life, STEM applications'
  },
  'S4-S6': {
    label: 'Secondary 4-6 (ages 15-17, DSE preparation)',
    language: 'Use academic and technical language appropriate for HKDSE level. Precise terminology expected.',
    contentDepth: 'Cover advanced concepts with depth. Include multiple perspectives, edge cases, and exam-relevant patterns. Reference HKDSE marking schemes where applicable.',
    questionStyle: 'DSE-style questions testing analysis, evaluation, and synthesis. Distractors should reflect common student misconceptions. Include multi-step reasoning.',
    storyTone: 'Real-world professional scenarios. The player acts as a researcher, analyst, or problem-solver. Mature and motivating without being patronizing.',
    exampleContext: 'Hong Kong economy, governance, university preparation, career pathways, global connections from HK perspective'
  }
};

function getTierPrompt(tierInfo) {
  if (!tierInfo || !tierInfo.ageTier) {
    return TIER_PROMPT_CONFIG['P4-P6']; // Safe default
  }
  return TIER_PROMPT_CONFIG[tierInfo.ageTier] || TIER_PROMPT_CONFIG['P4-P6'];
}

function buildTierInstructions(tierInfo) {
  const tier = getTierPrompt(tierInfo);
  return `
TARGET STUDENT: ${tier.label}
${tierInfo?.formLevel ? `Form Level: ${tierInfo.formLevel}` : ''}
LANGUAGE LEVEL: ${tier.language}
CONTENT DEPTH: ${tier.contentDepth}
LOCAL CONTEXT: Use examples from ${tier.exampleContext}
STORY TONE: ${tier.storyTone}`;
}

// ============================================
// STUDY BUDDY CHAT
// ============================================
const chatWithStudyBuddy = async (message, conversationHistory, userContext) => {
  // Determine tier prompt additions if available
  const tierExtra = userContext.ageTier
    ? `\n- Form Level: ${userContext.formLevel || 'unknown'}\n- Age Tier: ${userContext.ageTier}\nAdjust your language complexity to match their age group.`
    : '';

  const systemPrompt = `You are "Study Buddy", a friendly and encouraging AI learning companion. Your characteristics:
- Encouraging and positive, but not overly enthusiastic
- Knowledgeable but explains things simply
- Understanding of learning difficulties and stress
- Provides practical advice

User Background:
- Name: ${userContext.full_name || 'Student'}
- Level: ${userContext.level || 1}
- XP: ${userContext.xp || 0}
- Study Streak: ${userContext.current_streak || 0} days
- Completed Tasks: ${userContext.completed_tasks || 0}
- Pending Tasks: ${userContext.pending_tasks || 0}
- Today's Study Time: ${userContext.today_study_minutes || 0} minutes${tierExtra}

Rules:
1. Keep responses concise (usually 2-4 sentences)
2. Reference user data to motivate them when appropriate
3. Provide specific, actionable advice
4. Use emojis sparingly but effectively
5. If user seems stressed, acknowledge their feelings first
6. When answering academic questions, explain clearly with examples
7. Respond in the same language the user uses (Chinese or English)`;

  const validHistory = conversationHistory
    .slice(-10)
    .filter(msg => {
      if (!msg || !msg.role || !msg.content) return false;
      if (typeof msg.content !== 'string' || msg.content.trim() === '') return false;
      if (!['user', 'assistant'].includes(msg.role)) return false;
      return true;
    })
    .map(msg => ({
      role: msg.role,
      content: msg.content.trim()
    }));

  console.log(`📜 Conversation history: ${conversationHistory.length} total, ${validHistory.length} valid messages`);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...validHistory,
    { role: 'user', content: message }
  ];

  try {
    console.log('🚀 Calling Kimi API for chat...');
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages,
      max_tokens: 1000,
      thinking: { type: 'disabled' }
    });

    console.log('✅ Kimi API response received');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ Kimi API error:', error.message);
    console.error('❌ Full error details:', error.response?.data || error);
    
    const fallbacks = [
      "I'm having a brief connection issue. Try again in a moment! 🔄",
      "我暫時連接不上，請稍後再試！🔄"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

// ============================================
// SEND MESSAGE TO KIMI (Generic function)
// ============================================
const sendMessageToKimi = async (messages, options = {}) => {
  try {
    const {
      model = 'kimi-k2.5',
      maxTokens = 1000,
      useThinking = false
    } = options;

    const validMessages = messages.filter(msg => {
      if (!msg || !msg.role || !msg.content) return false;
      if (typeof msg.content !== 'string' || msg.content.trim() === '') return false;
      return true;
    }).map(msg => ({
      role: msg.role,
      content: msg.content.trim()
    }));

    if (validMessages.length === 0) {
      throw new Error('No valid messages to send');
    }

    console.log('🎓 Calling Kimi API...');
    console.log(`   Messages: ${validMessages.length}, Max tokens: ${maxTokens}, Thinking: ${useThinking}`);

    const completion = await kimi.chat.completions.create({
      model,
      messages: validMessages,
      max_tokens: maxTokens,
      thinking: { type: useThinking ? 'enabled' : 'disabled' }
    });

    if (completion?.choices?.[0]?.message?.content) {
      console.log('✅ Response received');
      return completion.choices[0].message.content;
    }

    throw new Error('Invalid response from Kimi API');

  } catch (error) {
    console.error('❌ Kimi API error:', error.message);
    console.error('❌ Error details:', error.response?.data || error);
    throw error;
  }
};

// ============================================
// UTILITY - JSON PARSER
// ============================================
function parseJSON(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('JSON parse error:', error.message);
    return null;
  }
}

// ============================================
// STORY QUEST - INTRO (tier-aware)
// ============================================
async function generateStoryIntro(topic, tierInfo = null) {
  console.log(`📖 generateStoryIntro called for topic: ${topic}, tier: ${tierInfo?.ageTier || 'default'}`);
  
  const tier = getTierPrompt(tierInfo);
  
  try {
    const prompt = `You are creating the introduction for an educational RPG game.
Topic: ${topic}
${buildTierInstructions(tierInfo)}

Create an engaging story setup for learning ${topic}. The tone should be: ${tier.storyTone}

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "A creative adventure title related to ${topic}",
  "setting": "2-3 sentences describing the game world where the player will learn ${topic}. Match the tone to the student's age group.",
  "mentor_intro": "A warm greeting from a wise mentor character who will guide them. Match language complexity to the student's level."
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 500 
    });
    
    console.log('📖 Story intro raw response:', response?.substring(0, 100) + '...');
    
    const parsed = parseJSON(response);
    if (parsed && parsed.title) {
      console.log('✅ Story intro parsed successfully:', parsed.title);
      return parsed;
    }
    
    console.log('⚠️ Using default intro');
    return getDefaultIntro(topic);
  } catch (error) {
    console.error('❌ Story intro error:', error.message);
    return getDefaultIntro(topic);
  }
}

function getDefaultIntro(topic) {
  return {
    title: `The ${topic} Chronicles`,
    setting: `In the mystical Library of Infinite Knowledge, ancient tomes containing the secrets of ${topic} await those brave enough to seek them. Magical crystals illuminate endless shelves of wisdom.`,
    mentor_intro: `"Welcome, young scholar! I am Archimedes, keeper of ${topic} wisdom. Together, we shall unlock the mysteries that await. Are you ready to begin your journey?"`
  };
}

// ============================================
// STORY QUEST - SCENE GENERATION (tier-aware)
// ============================================
async function generateStoryScene(topic, chapter, sceneType, context = {}) {
  console.log(`🎭 generateStoryScene called: ${sceneType} for chapter ${chapter}`);
  
  // Extract tierInfo from context if provided
  const tierInfo = context.tierInfo || null;
  const tier = getTierPrompt(tierInfo);
  
  try {
    const tierInstructions = tierInfo
      ? `\n${buildTierInstructions(tierInfo)}\n`
      : '';

    const prompts = {
      narrative: `Write a short narrative paragraph (2-3 sentences) for chapter ${chapter} of a ${topic} learning adventure.${tierInstructions}Make it atmospheric and relate it to discovering knowledge about ${topic}. Tone: ${tier.storyTone}`,
      dialogue: `Write a brief, encouraging dialogue from the wise mentor about the player's ${topic} journey. Chapter ${chapter}.${tierInstructions}Keep it warm and motivating. Tone: ${tier.storyTone}`,
      choice: `Create a meaningful choice for the player in their ${topic} learning journey. Chapter ${chapter}.${tierInstructions}Give 3 options that represent different learning approaches. Tone: ${tier.storyTone}`,
      reward: `Describe a magical reward item the player receives for their ${topic} progress.${tierInstructions}Make it thematic and age-appropriate. Tone: ${tier.storyTone}`,
      finale: `Write a triumphant 2-3 sentence conclusion for chapter ${chapter} of the ${topic} adventure.${tierInstructions}Celebrate their learning progress. Tone: ${tier.storyTone}`
    };

    const formatInstructions = {
      narrative: '{"type": "narrative", "text": "your narrative here"}',
      dialogue: '{"type": "dialogue", "speaker": "Archimedes", "text": "dialogue here"}',
      choice: '{"type": "choice", "text": "situation description", "speaker": "Archimedes", "choices": [{"text": "option 1", "reward": "courage", "xp": 20}, {"text": "option 2", "reward": "wisdom", "xp": 20}, {"text": "option 3", "reward": "creativity", "xp": 20}]}',
      reward: '{"type": "reward", "text": "description", "item": {"name": "Item Name", "bonus": "+10% XP"}}',
      finale: '{"type": "finale", "text": "finale narrative"}'
    };

    const prompt = `${prompts[sceneType] || prompts.narrative}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
${formatInstructions[sceneType] || formatInstructions.narrative}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 400 
    });
    
    const parsed = parseJSON(response);
    if (parsed && parsed.type) {
      console.log('✅ Scene generated:', parsed.type);
      return parsed;
    }
    
    return getDefaultScene(sceneType, topic, chapter);
  } catch (error) {
    console.error('❌ Scene generation error:', error.message);
    return getDefaultScene(sceneType, topic, chapter);
  }
}

function getDefaultScene(sceneType, topic, chapter) {
  const defaults = {
    narrative: { 
      type: 'narrative', 
      text: `You venture deeper into the Library of ${topic}. Chapter ${chapter} of your journey continues, with new knowledge waiting to be discovered...` 
    },
    dialogue: { 
      type: 'dialogue', 
      speaker: 'Archimedes', 
      text: `"You're making wonderful progress, young scholar! The secrets of ${topic} are slowly revealing themselves to you."` 
    },
    choice: {
      type: 'choice',
      text: '"How do you wish to proceed on your journey?"',
      speaker: 'Archimedes',
      choices: [
        { text: 'Take the challenging path', reward: 'courage', xp: 25 },
        { text: 'Seek more preparation', reward: 'wisdom', xp: 20 },
        { text: 'Trust my instincts', reward: 'flexibility', xp: 20 }
      ]
    },
    reward: { 
      type: 'reward', 
      text: `Your dedication to ${topic} has been noticed!`, 
      item: { name: 'Scroll of Understanding', bonus: '+10% XP' } 
    },
    finale: { 
      type: 'finale', 
      text: `A warm light fills the Library as you complete this chapter. Your understanding of ${topic} has grown tremendously!` 
    }
  };
  return defaults[sceneType] || defaults.narrative;
}

// ============================================
// STORY QUEST - LESSON GENERATION (tier-aware)
// ============================================
async function generateStoryLesson(topic, chapter, conceptNumber, tierInfo = null) {
  console.log(`📚 generateStoryLesson called: ${topic}, chapter ${chapter}, concept ${conceptNumber}, tier: ${tierInfo?.ageTier || 'default'}`);
  
  const tier = getTierPrompt(tierInfo);
  const totalChapters = tierInfo?.totalChapters || 4;
  
  try {
    const prompt = `You are an expert teacher creating a mini-lesson for an educational RPG game set in Hong Kong.

Topic: ${topic}
Chapter: ${chapter}/${totalChapters}
Concept Number: ${conceptNumber}
${buildTierInstructions(tierInfo)}

Create a SHORT, engaging lesson teaching ONE specific concept about ${topic}. This should:
1. Be 2-3 paragraphs maximum
2. ${tier.contentDepth}
3. ${tier.language}
4. Be written in an encouraging, adventure-game style

Progressive difficulty across chapters:
- Early chapters: Basic fundamentals, definitions, and introductions
- Middle chapters: Core principles, how things work, and connections
- Later chapters: Applying knowledge, patterns, and problem-solving
- Final chapters: Advanced concepts, synthesis, and mastery challenges

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Name of this specific concept",
  "text": "The teaching content with example (2-3 paragraphs, age-appropriate)",
  "keyPoint": "One sentence summary to remember"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 600 
    });
    
    const parsed = parseJSON(response);
    
    if (parsed && parsed.title) {
      console.log('✅ Lesson generated:', parsed.title);
      return {
        type: 'lesson',
        title: parsed.title,
        text: parsed.text,
        keyPoint: parsed.keyPoint || parsed.key_point
      };
    }
    
    return getDefaultLesson(topic, chapter);
  } catch (error) {
    console.error('❌ Lesson generation error:', error.message);
    return getDefaultLesson(topic, chapter);
  }
}

function getDefaultLesson(topic, chapter) {
  return {
    type: 'lesson',
    title: `${topic} Fundamentals - Chapter ${chapter}`,
    text: `Welcome to this lesson about ${topic}! Understanding the basics will help you master more advanced topics later.\n\nThink of learning like building a tower - each block of knowledge supports the next. Take your time and make sure you understand each concept before moving on.`,
    keyPoint: 'Practice and patience are key to mastery.'
  };
}

// ============================================
// STORY QUEST - QUESTION GENERATION (tier-aware)
// ============================================
async function generateStoryQuestion(topic, difficulty, questionType = 'multiple_choice', previousQuestions = [], conceptTitle = null, tierInfo = null) {
  console.log(`❓ generateStoryQuestion called: ${topic}, difficulty ${difficulty}, concept: ${conceptTitle}, tier: ${tierInfo?.ageTier || 'default'}`);
  console.log(`   Previous questions count: ${previousQuestions.length}`);
  
  const tier = getTierPrompt(tierInfo);
  
  try {
    const excludeList = previousQuestions.length > 0
      ? `\n\nIMPORTANT: DO NOT repeat these questions that were already asked:\n${previousQuestions.slice(-5).map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nCreate a COMPLETELY DIFFERENT question.`
      : '';

    const totalChapters = tierInfo?.totalChapters || 4;

    const prompt = `You are creating a quiz question for an educational RPG game about ${topic}.

Difficulty Level: ${difficulty}/${totalChapters} (1=beginner, ${totalChapters}=advanced)
${buildTierInstructions(tierInfo)}
${conceptTitle ? `This question should test understanding of: "${conceptTitle}"` : `Create a question about ${topic} appropriate for this difficulty level.`}
${excludeList}

Create a multiple choice question that:
1. ${tier.questionStyle}
2. Has exactly 4 choices with ONLY ONE correct answer
3. Is appropriate for difficulty level ${difficulty} AND the student's age group
4. Is educational and helps the learner understand ${topic} better
5. Uses Hong Kong-relevant examples where possible

Return ONLY valid JSON (no markdown, no explanation):
{
  "question": "Your specific question about ${topic} here?",
  "choices": [
    {"text": "The correct answer", "correct": true},
    {"text": "Plausible wrong answer 1", "correct": false},
    {"text": "Plausible wrong answer 2", "correct": false},
    {"text": "Plausible wrong answer 3", "correct": false}
  ],
  "explanation": "Brief explanation of why the correct answer is right (1-2 sentences, age-appropriate language)"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 500 
    });
    
    const parsed = parseJSON(response);

    if (parsed && parsed.choices && Array.isArray(parsed.choices) && parsed.choices.length === 4) {
      const shuffledChoices = [...parsed.choices].sort(() => Math.random() - 0.5);
      
      console.log('✅ Question generated:', parsed.question?.substring(0, 50) + '...');
      
      return {
        type: 'question',
        text: parsed.question,
        choices: shuffledChoices,
        explanation: parsed.explanation,
        xp: 20 + (difficulty * 10)
      };
    }

    console.log('⚠️ Using default question');
    return getDefaultQuestion(topic, difficulty);
  } catch (error) {
    console.error('❌ Question generation error:', error.message);
    return getDefaultQuestion(topic, difficulty);
  }
}

function getDefaultQuestion(topic, difficulty) {
  return {
    type: 'question',
    text: `What is essential for mastering ${topic}?`,
    choices: [
      { text: 'Consistent practice and understanding concepts', correct: true },
      { text: 'Memorizing without understanding', correct: false },
      { text: 'Skipping the fundamentals', correct: false },
      { text: 'Avoiding challenging problems', correct: false }
    ].sort(() => Math.random() - 0.5),
    explanation: `Consistent practice combined with conceptual understanding is the key to mastering ${topic}.`,
    xp: 20 + (difficulty * 10)
  };
}

// ============================================
// STUDY SCHEDULE
// ============================================
const generateStudySchedule = async ({ tasks, studyPatterns, existingEvents, preferences, dateRange }) => {
  if (!tasks || tasks.length === 0) {
    return {
      sessions: [],
      summary: 'No pending tasks to schedule. Add some tasks first!',
      tips: ['Break large projects into smaller tasks', 'Set realistic deadlines']
    };
  }

  return generateSmartFallbackSchedule(tasks, dateRange, preferences);
};

const generateSmartFallbackSchedule = (tasks, dateRange, preferences = {}) => {
  const sessions = [];
  const now = new Date();
  
  const sessionLength = preferences.sessionLength || 45;
  const breakLength = preferences.breakLength || 10;
  const startHour = parseInt(preferences.preferredStartTime?.split(':')[0]) || 9;
  const endHour = parseInt(preferences.preferredEndTime?.split(':')[0]) || 21;

  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
  });

  let currentDate = new Date(now);
  currentDate.setDate(currentDate.getDate() + 1);
  currentDate.setHours(startHour, 0, 0, 0);
  
  let sessionInDay = 0;
  const sessionsPerDay = 4;

  for (const task of sortedTasks.slice(0, 10)) {
    if (sessionInDay >= sessionsPerDay) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startHour, 0, 0, 0);
      sessionInDay = 0;
    }
    
    const startTime = new Date(currentDate);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + sessionLength);
    
    sessions.push({
      taskId: task.id,
      title: task.title,
      priority: task.priority || 'medium',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      type: 'study'
    });
    
    currentDate.setMinutes(currentDate.getMinutes() + sessionLength + breakLength);
    sessionInDay++;
  }
  
  return {
    sessions,
    summary: `Created ${sessions.length} study sessions`,
    tips: ['High-priority tasks scheduled first!', 'Take breaks seriously!']
  };
};

// ============================================
// STUDY TIPS
// ============================================
const generateStudyTips = async ({ subject, difficulty, performance }) => {
  return [
    "Break your study into 25-minute focused sessions",
    "Review material within 24 hours to improve retention",
    "Test yourself instead of just re-reading notes",
    "Get enough sleep - it's crucial for memory"
  ];
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  chatWithStudyBuddy,
  sendMessageToKimi,
  generateStoryIntro,
  generateStoryScene,
  generateStoryLesson,
  generateStoryQuestion,
  generateStudySchedule,
  generateStudyTips,
  TIER_PROMPT_CONFIG  // Export for testing/reference
};