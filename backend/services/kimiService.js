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
    language: 'Use very simple English. Short sentences only (5-8 words). Basic words only.',
    contentDepth: 'One simple idea at a time. Use toys, food, animals as examples.',
    questionStyle: 'Simple questions with obvious answers. Keep answers under 5 words.',
    storyTone: 'Fun, magical, and friendly. Lots of praise!',
    exampleContext: 'Hong Kong primary school — MTR, dim sum, Ocean Park'
  },
  'P4-P6': {
    label: 'Primary 4-6 (ages 9-11)',
    language: 'Use clear, simple English. Short sentences. Easy words.',
    contentDepth: 'Explain with everyday examples. One simple comparison.',
    questionStyle: 'Test understanding. Wrong answers are clearly wrong.',
    storyTone: 'Adventurous and fun. You are on a quest!',
    exampleContext: 'Hong Kong — Victoria Harbour, festivals, school projects'
  },
  'S1-S3': {
    label: 'Secondary 1-3 (ages 12-14)',
    language: 'Use normal English. Some school words are OK.',
    contentDepth: 'Explain how things work. Connect ideas together.',
    questionStyle: 'Test thinking. Ask "why" and "how" questions.',
    storyTone: 'Mystery solving. Use knowledge to win!',
    exampleContext: 'Hong Kong life — technology, environment, daily issues'
  },
  'S4-S6': {
    label: 'Secondary 4-6 (ages 15-17, DSE)',
    language: 'Use proper school English. Technical words expected.',
    contentDepth: 'Deep understanding. Multiple views. HKDSE style.',
    questionStyle: 'DSE-style questions. Test analysis and evaluation.',
    storyTone: 'Real world problems. You are the expert!',
    exampleContext: 'Hong Kong — economy, university, careers, global issues'
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
// THE PROCRASTINATION PROPHECY - NARRATIVE HELPERS
// ============================================

const NARRATIVE_CONTEXT = {
  // Simple hero story background - short and sweet
  heroStory: `You are a Hero of Learning. The world needs you!
The Shadow of Doom (distraction/procrastination) wants to stop you.
Every time you study, you grow stronger.
If you miss a day, the Shadow grows.
Your mission: Learn, grow, and save the world from ignorance!`,

  // Shadow messages based on level
  getShadowMessage: (shadowLevel) => {
    if (shadowLevel === 0) return '';
    if (shadowLevel <= 20) return 'The Shadow watches from far away.';
    if (shadowLevel <= 40) return 'The Shadow is getting closer...';
    if (shadowLevel <= 60) return 'The Shadow grows stronger! Study to push it back!';
    if (shadowLevel <= 80) return 'WARNING: The Shadow is very strong! Study now!';
    return 'DANGER! The Shadow of Doom threatens to win! Study immediately!';
  },

  // Hero power messages
  getHeroMessage: (heroPower, streakDays) => {
    if (streakDays >= 30) return 'LEGENDARY HERO! The Shadow fears your power!';
    if (streakDays >= 14) return 'Master Hero! Your light shines bright!';
    if (streakDays >= 7) return 'Guardian Hero! You protect learning!';
    if (streakDays >= 3) return 'Rising Hero! Your power grows!';
    if (heroPower >= 20) return 'You are getting stronger!';
    return 'Every study session makes you stronger!';
  }
};

// ============================================
// STUDY BUDDY CHAT
// ============================================
const chatWithStudyBuddy = async (message, conversationHistory, userContext) => {
  // Determine tier prompt additions if available
  const tierExtra = userContext.ageTier
    ? `\n- Form Level: ${userContext.formLevel || 'unknown'}\n- Age Tier: ${userContext.ageTier}\nAdjust your language complexity to match their age group.`
    : '';

  // Add Procrastination Prophecy context
  const narrativeExtra = userContext.heroPower 
    ? `\n- Hero Power: ${userContext.heroPower}/100\n- Current Streak: ${userContext.current_streak || 0} days\n- Shadow Level: ${userContext.shadowDoom || 0}/100\nEncourage them to study to grow their Hero Power and push back the Shadow!`
    : '';

  const systemPrompt = `You are "Study Buddy", a friendly AI learning companion. You know about The Procrastination Prophecy - where students are Heroes fighting the Shadow of Doom (procrastination).

User Background:
- Name: ${userContext.full_name || 'Student'}
- Level: ${userContext.level || 1}
- XP: ${userContext.xp || 0}
- Study Streak: ${userContext.current_streak || 0} days
- Completed Tasks: ${userContext.completed_tasks || 0}
- Today's Study Time: ${userContext.today_study_minutes || 0} minutes${tierExtra}${narrativeExtra}

Rules:
1. Keep responses short (2-4 sentences)
2. Mention their Hero Power or Streak when relevant
3. If they haven't studied today, gently remind them: "The Shadow grows when we don't study!"
4. If they have a good streak, celebrate: "Your Hero Power is amazing!"
5. Give specific, simple advice
6. Use emojis sparingly
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
// STORY QUEST - INTRO (Simplified for Procrastination Prophecy)
// ============================================
async function generateStoryIntro(topic, tierInfo = null, heroContext = null) {
  console.log(`📖 generateStoryIntro called for topic: ${topic}, tier: ${tierInfo?.ageTier || 'default'}`);
  
  const tier = getTierPrompt(tierInfo);
  
  // Build hero context message
  let heroContextMsg = '';
  if (heroContext) {
    heroContextMsg = `
HERO STATUS:
- Hero Power: ${heroContext.heroPower || 10}/100
- Current Streak: ${heroContext.streakDays || 0} days
- Shadow Level: ${heroContext.shadowDoom || 0}/100
- Current Stage: ${heroContext.currentStage || 1}/10`;
  }
  
  try {
    const prompt = `Create a short intro for a learning adventure.

TOPIC TO LEARN: ${topic}
${buildTierInstructions(tierInfo)}${heroContextMsg}

STORY SETUP (Keep it SHORT and SIMPLE):
- The student is a Hero of Learning
- They need to master ${topic} to grow stronger
- The Shadow of Doom (procrastination) wants to stop them
- Every lesson makes the Hero more powerful

RULES:
1. Title should be exciting but short
2. Setting: 1-2 sentences ONLY
3. Mentor message: Warm, simple, encouraging
4. Use ${tier.language}

Return ONLY valid JSON (no markdown):
{
  "title": "Short exciting title about ${topic}",
  "setting": "1-2 sentences. The hero must learn ${topic} to save the world from ignorance.",
  "mentor_intro": "A short welcome message from your study guide. Mention that studying ${topic} will increase Hero Power and push back the Shadow.",
  "hero_message": "A short motivational message about being a Hero of Learning",
  "shadow_status": "${NARRATIVE_CONTEXT.getShadowMessage(heroContext?.shadowDoom || 0)}"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 400 
    });
    
    console.log('📖 Story intro raw response:', response?.substring(0, 100) + '...');
    
    const parsed = parseJSON(response);
    if (parsed && parsed.title) {
      console.log('✅ Story intro parsed successfully:', parsed.title);
      return parsed;
    }
    
    console.log('⚠️ Using default intro');
    return getDefaultIntro(topic, heroContext);
  } catch (error) {
    console.error('❌ Story intro error:', error.message);
    return getDefaultIntro(topic, heroContext);
  }
}

function getDefaultIntro(topic, heroContext = null) {
  const shadowMsg = NARRATIVE_CONTEXT.getShadowMessage(heroContext?.shadowDoom || 0);
  const heroMsg = NARRATIVE_CONTEXT.getHeroMessage(heroContext?.heroPower || 10, heroContext?.streakDays || 0);
  
  return {
    title: `The ${topic} Quest`,
    setting: `The world needs heroes who know ${topic}. The Shadow of Doom spreads ignorance. You must learn to fight back!`,
    mentor_intro: `"Welcome, Hero! I am your guide. Learning ${topic} will make you stronger. Let's push back the Shadow together!"`,
    hero_message: heroMsg,
    shadow_status: shadowMsg
  };
}

// ============================================
// STORY QUEST - SCENE GENERATION (Simplified)
// ============================================
async function generateStoryScene(topic, chapter, sceneType, context = {}) {
  console.log(`🎭 generateStoryScene called: ${sceneType} for chapter ${chapter}`);
  
  const tierInfo = context.tierInfo || null;
  const tier = getTierPrompt(tierInfo);
  const heroContext = context.heroContext || null;
  
  try {
    const tierInstructions = tierInfo
      ? `\n${buildTierInstructions(tierInfo)}\n`
      : '';

    const heroContextMsg = heroContext 
      ? `\nThe student has Hero Power ${heroContext.heroPower}/100 and ${heroContext.streakDays} day streak. The Shadow is at ${heroContext.shadowDoom}/100.` 
      : '';

    const prompts = {
      narrative: `Write 1-2 short sentences about the hero learning ${topic}.${tierInstructions}${heroContextMsg} Keep it simple. The hero is getting stronger. Tone: ${tier.storyTone}`,
      
      dialogue: `Write a short encouraging message (1-2 sentences) from the mentor about learning ${topic}.${tierInstructions} Mention that studying makes the hero stronger against the Shadow. Tone: ${tier.storyTone}`,
      
      choice: `Create a simple choice for the hero learning ${topic}.${tierInstructions} Give 3 options about different ways to study. Each option gives XP. Tone: ${tier.storyTone}`,
      
      reward: `Describe a simple reward the hero gets for learning ${topic}.${tierInstructions} Make it a tool or power that helps fight the Shadow. Tone: ${tier.storyTone}`,
      
      finale: `Write 2 short sentences celebrating the hero's progress in ${topic}.${tierInstructions} Mention they grew stronger and pushed back the Shadow. Tone: ${tier.storyTone}`
    };

    const formatInstructions = {
      narrative: '{"type": "narrative", "text": "your short narrative here"}',
      dialogue: '{"type": "dialogue", "speaker": "Guide", "text": "short dialogue here"}',
      choice: '{"type": "choice", "text": "situation description", "speaker": "Guide", "choices": [{"text": "option 1", "reward": "courage", "xp": 20}, {"text": "option 2", "reward": "wisdom", "xp": 20}, {"text": "option 3", "reward": "focus", "xp": 20}]}',
      reward: '{"type": "reward", "text": "description", "item": {"name": "Item Name", "bonus": "+10% XP"}}',
      finale: '{"type": "finale", "text": "short finale text"}'
    };

    const prompt = `${prompts[sceneType] || prompts.narrative}

Return ONLY valid JSON (no markdown):
${formatInstructions[sceneType] || formatInstructions.narrative}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 350 
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
      text: `You study ${topic}. Your Hero Power grows!` 
    },
    dialogue: { 
      type: 'dialogue', 
      speaker: 'Guide', 
      text: `"Keep learning! Every lesson makes you stronger against the Shadow."` 
    },
    choice: {
      type: 'choice',
      text: '"How will you study?"',
      speaker: 'Guide',
      choices: [
        { text: 'Read carefully', reward: 'wisdom', xp: 20 },
        { text: 'Practice problems', reward: 'skill', xp: 25 },
        { text: 'Watch and learn', reward: 'insight', xp: 20 }
      ]
    },
    reward: { 
      type: 'reward', 
      text: `You got stronger at ${topic}!`, 
      item: { name: 'Power Crystal', bonus: '+10% XP' } 
    },
    finale: { 
      type: 'finale', 
      text: `Great job! You mastered this part of ${topic}. The Shadow retreats!` 
    }
  };
  return defaults[sceneType] || defaults.narrative;
}

// ============================================
// STORY QUEST - LESSON GENERATION (Simplified)
// ============================================
async function generateStoryLesson(topic, chapter, conceptNumber, tierInfo = null, heroContext = null) {
  console.log(`📚 generateStoryLesson called: ${topic}, chapter ${chapter}, concept ${conceptNumber}, tier: ${tierInfo?.ageTier || 'default'}`);
  
  const tier = getTierPrompt(tierInfo);
  const totalChapters = tierInfo?.totalChapters || 4;
  
  // Hero context message
  const heroMsg = heroContext 
    ? `The student is a Hero with Power ${heroContext.heroPower}/100. Frame this lesson as gaining a new ability to fight the Shadow of Doom.` 
    : '';
  
  try {
    const prompt = `Teach ONE simple concept about ${topic} for an educational game.

Chapter: ${chapter}/${totalChapters}
Concept Number: ${conceptNumber}
${buildTierInstructions(tierInfo)}
${heroMsg}

IMPORTANT RULES:
1. Title: Short and clear
2. Content: 2 short paragraphs maximum. Use simple words.
3. ${tier.contentDepth}
4. ${tier.language}
5. End with ONE key point to remember

Return ONLY valid JSON (no markdown):
{
  "title": "Name of this concept (short)",
  "text": "The teaching content (2 short paragraphs, simple language)",
  "keyPoint": "One sentence to remember"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 500 
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
    title: `${topic} Basics - Part ${chapter}`,
    text: `Welcome to ${topic}! Today you will learn something important.\n\nTake your time. Understanding is more important than speed.`,
    keyPoint: 'Practice makes you stronger.'
  };
}

// ============================================
// STORY QUEST - QUESTION GENERATION (Simplified)
// ============================================
async function generateStoryQuestion(topic, difficulty, questionType = 'multiple_choice', previousQuestions = [], conceptTitle = null, tierInfo = null) {
  console.log(`❓ generateStoryQuestion called: ${topic}, difficulty ${difficulty}, concept: ${conceptTitle}, tier: ${tierInfo?.ageTier || 'default'}`);
  console.log(`   Previous questions count: ${previousQuestions.length}`);
  
  const tier = getTierPrompt(tierInfo);
  
  try {
    const excludeList = previousQuestions.length > 0
      ? `\n\nDO NOT repeat these questions:\n${previousQuestions.slice(-5).map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
      : '';

    const totalChapters = tierInfo?.totalChapters || 4;

    const prompt = `Create a quiz question about ${topic}.

Difficulty: ${difficulty}/${totalChapters}
${buildTierInstructions(tierInfo)}
${conceptTitle ? `Test this concept: "${conceptTitle}"` : `Create a question about ${topic}.`}${excludeList}

RULES:
1. ${tier.questionStyle}
2. 4 choices. ONLY ONE correct answer.
3. Use simple Hong Kong examples if possible
4. Keep it short

Return ONLY valid JSON (no markdown):
{
  "question": "Your question here?",
  "choices": [
    {"text": "correct answer", "correct": true},
    {"text": "wrong answer 1", "correct": false},
    {"text": "wrong answer 2", "correct": false},
    {"text": "wrong answer 3", "correct": false}
  ],
  "explanation": "Why the answer is correct (1 sentence, simple)"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 400 
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
    text: `What is the best way to learn ${topic}?`,
    choices: [
      { text: 'Practice every day', correct: true },
      { text: 'Study only before tests', correct: false },
      { text: 'Never review', correct: false },
      { text: 'Skip hard parts', correct: false }
    ].sort(() => Math.random() - 0.5),
    explanation: 'Daily practice helps you remember and understand better.',
    xp: 20 + (difficulty * 10)
  };
}

// ============================================
// STUDY JOURNEY - Generate journey path
// ============================================
async function generateStudyJourney(studentId, currentStage, tierInfo = null) {
  console.log(`🗺️ Generating study journey for stage ${currentStage}`);
  
  const tier = getTierPrompt(tierInfo);
  
  try {
    const prompt = `Create a study journey milestone for stage ${currentStage} of 10.
${buildTierInstructions(tierInfo)}

This is part of "The Procrastination Prophecy" where students are Heroes fighting the Shadow of Doom.

Return ONLY valid JSON:
{
  "stage": ${currentStage},
  "title": "Short title for this stage",
  "description": "What the hero needs to do (2 sentences)",
  "challenge": "What they will learn or overcome",
  "reward": "What power they gain",
  "shadow_threat": "How the Shadow tries to stop them"
}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 350 
    });
    
    const parsed = parseJSON(response);
    if (parsed && parsed.title) {
      return parsed;
    }
    
    return getDefaultJourneyStage(currentStage);
  } catch (error) {
    console.error('❌ Journey generation error:', error.message);
    return getDefaultJourneyStage(currentStage);
  }
}

function getDefaultJourneyStage(stage) {
  const stages = {
    1: { stage: 1, title: "The Beginning", description: "Start your journey. Study for 15 minutes.", challenge: "First study session", reward: "Hero Badge", shadow_threat: "The Shadow whispers 'do it later'" },
    2: { stage: 2, title: "First Steps", description: "Build your first 3-day streak.", challenge: "3-day streak", reward: "Streak Shield", shadow_threat: "The Shadow says 'skip today'" },
    3: { stage: 3, title: "Rising Power", description: "Study 5 different subjects.", challenge: "Subject mastery", reward: "Knowledge Crystal", shadow_threat: "The Shadow hides your books" },
    4: { stage: 4, title: "The Guardian", description: "Complete a 7-day streak.", challenge: "One week warrior", reward: "Focus Helm", shadow_threat: "The Shadow brings distractions" },
    5: { stage: 5, title: "Week of Power", description: "Study 100 minutes in one week.", challenge: "Time master", reward: "Time Amulet", shadow_threat: "The Shadow steals your time" },
    6: { stage: 6, title: "Deep Focus", description: "Complete a 30-minute study session.", challenge: "Deep work", reward: "Concentration Ring", shadow_threat: "The Shadow breaks your focus" },
    7: { stage: 7, title: "The Scholar", description: "Answer 20 quiz questions correctly.", challenge: "Knowledge test", reward: "Wisdom Tome", shadow_threat: "The Shadow makes you doubt" },
    8: { stage: 8, title: "Two Weeks Strong", description: "Maintain a 14-day streak.", challenge: "Fortnight hero", reward: "Persistence Armor", shadow_threat: "The Shadow says 'you can stop now'" },
    9: { stage: 9, title: "Master Hero", description: "Study 200 minutes in one week.", challenge: "Study master", reward: "Legendary Crown", shadow_threat: "The Shadow attacks with tiredness" },
    10: { stage: 10, title: "The Legend", description: "Complete a 30-day streak. Conquer the Procrastination Prophecy!", challenge: "Ultimate victory", reward: "Victory Trophy", shadow_threat: "The Shadow is defeated!" }
  };
  return stages[stage] || stages[1];
}

// ============================================
// NARRATIVE MESSAGE - Get dynamic message based on state
// ============================================
function getNarrativeMessage(type, value) {
  const messages = {
    hero_power: [
      { min: 0, max: 20, msg: 'You are beginning your hero journey!' },
      { min: 21, max: 40, msg: 'Your power grows! Keep studying!' },
      { min: 41, max: 60, msg: 'You are a true Hero of Learning!' },
      { min: 61, max: 80, msg: 'The Shadow fears your dedication!' },
      { min: 81, max: 100, msg: 'LEGENDARY! You are unstoppable!' }
    ],
    shadow_warning: [
      { min: 0, max: 20, msg: '' },
      { min: 21, max: 40, msg: 'The Shadow is watching...' },
      { min: 41, max: 60, msg: 'The Shadow grows! Study to push it back!' },
      { min: 61, max: 80, msg: 'WARNING: The Shadow is strong!' },
      { min: 81, max: 100, msg: 'DANGER! Study now to defeat the Shadow!' }
    ]
  };
  
  const list = messages[type] || [];
  const match = list.find(m => value >= m.min && value <= m.max);
  return match ? match.msg : '';
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
  generateStudyJourney,
  getNarrativeMessage,
  getNarrativeContext: () => NARRATIVE_CONTEXT,
  TIER_PROMPT_CONFIG
};
