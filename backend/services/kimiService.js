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
      max_tokens: 2000,
      thinking: { type: 'enabled' }
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
      if (typeof msg.content !== 'string' && typeof msg.content !== 'object') return false;
      return true;
    }).map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content.trim() : msg.content
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

    console.log('📥 Raw response:', JSON.stringify(completion, null, 2).substring(0, 500));

    // Handle different response formats
    if (completion && completion.choices && completion.choices.length > 0) {
      const choice = completion.choices[0];
      if (choice.message && choice.message.content) {
        console.log('✅ Response received');
        return choice.message.content;
      }
      // Handle thinking mode which might have different structure
      if (choice.message && choice.message.thinking) {
        console.log('✅ Response received (thinking mode)');
        return choice.message.thinking;
      }
    }

    console.error('❌ Unexpected response structure:', JSON.stringify(completion, null, 2));
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
      maxTokens: 800,
      useThinking: false
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
      maxTokens: 600,
      useThinking: false
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
      maxTokens: 1000,
      useThinking: false
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
// STORY QUEST - QUESTION GENERATION (Strict Factual Content)
// ============================================
async function generateStoryQuestion(topic, difficulty, questionType = 'multiple_choice', previousQuestions = [], conceptTitle = null, tierInfo = null, subject = null) {
  // Determine actual subject (use passed subject or infer from topic)
  const actualSubject = subject || topic;
  console.log(`❓ generateStoryQuestion called: ${topic} (Subject: ${actualSubject}), difficulty ${difficulty}, concept: ${conceptTitle}, tier: ${tierInfo?.ageTier || 'default'}`);
  console.log(`   Previous questions count: ${previousQuestions.length}`);
  
  const tier = getTierPrompt(tierInfo);
  
  try {
    const excludeList = previousQuestions.length > 0
      ? `\n\nDO NOT repeat these questions:\n${previousQuestions.slice(-5).map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
      : '';

    const totalChapters = tierInfo?.totalChapters || 4;
    const chapterTitle = conceptTitle || `${topic} - Chapter ${difficulty}`;

    // SUBJECT-SPECIFIC chapter content mapping
    const chapterContentMap = {
      // Mathematics chapters
      'Mathematics:The Beginning': 'number systems, counting, Hindu-Arabic numerals, zero, place value, natural numbers',
      'Mathematics:First Trials': 'basic operations, addition, subtraction, multiplication, division',
      'Mathematics:The Challenge': 'equations, variables, solving for x, algebraic expressions',
      'Mathematics:Final Confrontation': 'advanced problems, word problems, applications',
      
      // History chapters  
      'History:The Beginning': 'prehistory, early humans, first civilizations, Stone Age, archaeology',
      'History:First Trials': 'ancient civilizations, Egypt, Mesopotamia, Indus Valley, pharaohs',
      'History:The Challenge': 'classical empires, Rome, Greece, major conflicts, wars',
      'History:Final Confrontation': 'modern history, revolutions, world wars, independence',
      
      // Science chapters
      'Science:The Beginning': 'scientific method, observation, hypothesis, experiments, curiosity',
      'Science:First Trials': 'basic physics, forces, motion, simple machines, energy',
      'Science:The Challenge': 'chemistry basics, atoms, elements, compounds, reactions',
      'Science:Final Confrontation': 'advanced concepts, applications, modern science, discoveries',
      
      // Specific topics
      'Ancient Egypt': 'pharaohs, pyramids, Nile River, mummification, hieroglyphics',
      'World War II': '1939-1945, Hitler, Churchill, D-Day, Pearl Harbor, atomic bomb',
      'Origins of Civilization': 'Mesopotamia, Egypt, Indus Valley, writing, agriculture',
      'The Roman Empire': 'Caesar, Colosseum, legions, fall of Rome, gladiators',
      'Renaissance': 'Leonardo da Vinci, Michelangelo, Florence, art, science rebirth',
      'Industrial Revolution': 'steam engine, factories, trains, urbanization, 1760-1840'
    };
    
    // Look up subject-specific content first, then generic
    const subjectKey = `${actualSubject}:${chapterTitle}`;
    const chapterContent = chapterContentMap[subjectKey] || chapterContentMap[chapterTitle] || `${actualSubject} fundamentals`;
    
    // Subject-specific forbidden topics
    const forbiddenMap = {
      'Mathematics': 'Big Bang, universe, galaxy, atoms, molecules, ancient civilizations, pharaohs, wars, history events',
      'History': 'equations, formulas, atoms, molecules, calculations, theorems, geometry, algebra',
      'Science': 'historical dates without scientific context, ancient pharaohs, wars, equations without context'
    };
    const forbiddenTopics = forbiddenMap[actualSubject] || 'unrelated topics';

    const prompt = `You are writing a quiz question for Hong Kong secondary students (Form 1-3, ages 12-15).

🎯 CRITICAL CONTEXT:
- SUBJECT: ${actualSubject.toUpperCase()} (STAY FOCUSED ON THIS!)
- CHAPTER: ${chapterTitle}
- CHAPTER CONTENT INCLUDES: ${chapterContent}
- DIFFICULTY: ${difficulty}/5

🚫 FORBIDDEN FOR ${actualSubject.toUpperCase()}: NEVER mention ${forbiddenTopics}

🚫 STRICT FORBIDDEN LIST - NEVER VIOLATE THESE:
1. NEVER ask "What is ${actualSubject}?" or "What is history/science/math?"
2. NEVER ask "Why study ${actualSubject}?" or "Why is ${actualSubject} important?"
3. NEVER ask about "key concepts" or "main ideas" of ${actualSubject}
4. NEVER use these answers: "Understanding fundamentals", "Practice every day", "Study hard", "Never give up"
5. NEVER ask about learning methods or study strategies
6. NEVER ask about topics unrelated to ${actualSubject}

✅ REQUIRED - YOUR QUESTION MUST:
1. Ask about SPECIFIC ${actualSubject} content: ${chapterContent}
2. Have answers that are REAL FACTS (names, years, places, numbers, objects)
3. Be answerable based ONLY on the chapter content listed above
4. Teach actual ${actualSubject} knowledge

📚 EXAMPLES OF GOOD QUESTIONS BY SUBJECT:

History Chapter "Ancient Egypt":
Q: "Which river was essential for farming in Ancient Egypt?"
A: Nile River / Amazon / Mississippi / Thames

History Chapter "World War II":  
Q: "In what year did World War II begin?"
A: 1939 / 1914 / 1945 / 1936

Science Chapter "Photosynthesis":
Q: "What green substance in plants absorbs sunlight?"
A: Chlorophyll / Glucose / Oxygen / Carbon dioxide

Math Chapter "Geometry":
Q: "How many degrees are in a triangle?"
A: 180 / 90 / 360 / 270

YOUR QUESTION for "${chapterTitle}" (${actualSubject}):
- Must test: ${chapterContent}
- Difficulty ${difficulty}: ${difficulty <= 2 ? 'Basic fact (what/who/when)' : difficulty <= 4 ? 'Understanding (how/why)' : 'Analysis (compare/evaluate)'}

OUTPUT VALID JSON ONLY:
{
  "question": "Your specific ${actualSubject} question here?",
  "choices": [
    {"text": "Wrong fact", "correct": false},
    {"text": "Correct fact", "correct": true},
    {"text": "Wrong fact", "correct": false},
    {"text": "Wrong fact", "correct": false}
  ],
  "explanation": "2-3 sentences explaining the ${actualSubject} answer."
}

⚠️ IF YOU GENERATE A META-QUESTION ABOUT STUDYING, IT WILL BE REJECTED.
⚠️ IF ANSWERS INCLUDE "FUNDAMENTALS", "PRACTICE", "STUDYING", IT WILL BE REJECTED.
⚠️ IF CONTENT IS NOT ABOUT ${actualSubject}, IT WILL BE REJECTED.

Generate a VALID ${actualSubject} question now:${excludeList}`;

    const response = await sendMessageToKimi([{ role: 'user', content: prompt }], { 
      maxTokens: 1200,
      useThinking: false
    });
    
    const parsed = parseJSON(response);

    // Validate the question is not a meta-question
    const isValidQuestion = (q) => {
      if (!q || typeof q !== 'string') return false;
      const lowerQ = q.toLowerCase();
      
      // Reject meta-questions
      const forbiddenPatterns = [
        'what is history',
        'what is science',
        'what is math',
        'what is mathematics',
        'what is geography',
        'key concept',
        'why study',
        'why is it important',
        'how to learn',
        'best way to',
        'fundamentals of',
        'importance of'
      ];
      
      for (const pattern of forbiddenPatterns) {
        if (lowerQ.includes(pattern)) {
          console.log(`🚫 REJECTED meta-question: "${q}"`);
          return false;
        }
      }
      
      // Reject answers about studying methods
      if (parsed.choices && Array.isArray(parsed.choices)) {
        const forbiddenAnswers = ['fundamentals', 'practice', 'study hard', 'never give up', 'understanding'];
        for (const choice of parsed.choices) {
          if (choice.text) {
            const lowerText = choice.text.toLowerCase();
            for (const forbidden of forbiddenAnswers) {
              if (lowerText.includes(forbidden)) {
                console.log(`🚫 REJECTED answer with "${forbidden}": "${choice.text}"`);
                return false;
              }
            }
          }
        }
      }
      
      return true;
    };

    if (parsed && parsed.choices && Array.isArray(parsed.choices) && parsed.choices.length === 4) {
      // Validate question is not a meta-question
      if (!isValidQuestion(parsed.question)) {
        console.log('⚠️ Generated question was meta-question, using fallback');
        return getDefaultQuestion(topic, difficulty, chapterTitle);
      }
      
      const shuffledChoices = [...parsed.choices].sort(() => Math.random() - 0.5);
      
      console.log('✅ VALID question generated:', parsed.question?.substring(0, 60) + '...');
      
      return {
        type: 'question',
        text: parsed.question,
        choices: shuffledChoices,
        explanation: parsed.explanation,
        xp: 20 + (difficulty * 10)
      };
    }

    console.log('⚠️ Using default question');
    return getDefaultQuestion(topic, difficulty, chapterTitle);
  } catch (error) {
    console.error('❌ Question generation error:', error.message);
    return getDefaultQuestion(topic, difficulty, chapterTitle);
  }
}

// ============================================
// FALLBACK QUESTIONS BY TOPIC (No meta-questions!)
// ============================================
function getDefaultQuestion(topic, difficulty, chapterTitle = '') {
  const topicLower = topic.toLowerCase();
  const chapterLower = chapterTitle.toLowerCase();
  
  // History fallbacks
  if (topicLower.includes('history') || chapterLower.includes('ancient') || chapterLower.includes('war') || chapterLower.includes('empire')) {
    const historyQuestions = [
      {
        text: 'Which ancient civilization is famous for building pyramids?',
        choices: [
          { text: 'The Romans', correct: false },
          { text: 'The Ancient Egyptians', correct: true },
          { text: 'The Greeks', correct: false },
          { text: 'The Vikings', correct: false }
        ],
        explanation: 'The Ancient Egyptians built the pyramids as tombs for their pharaohs. The Great Pyramid of Giza was built around 2560 BCE.'
      },
      {
        text: 'In what year did World War II end?',
        choices: [
          { text: '1939', correct: false },
          { text: '1945', correct: true },
          { text: '1918', correct: false },
          { text: '1950', correct: false }
        ],
        explanation: 'World War II ended in 1945 when Germany surrendered in May and Japan surrendered in September after atomic bombs were dropped on Hiroshima and Nagasaki.'
      },
      {
        text: 'Who was the first Emperor of Rome?',
        choices: [
          { text: 'Julius Caesar', correct: false },
          { text: 'Augustus', correct: true },
          { text: 'Nero', correct: false },
          { text: 'Constantine', correct: false }
        ],
        explanation: 'Augustus (Octavian) became the first Roman Emperor in 27 BCE, marking the end of the Roman Republic and the beginning of the Roman Empire.'
      },
      {
        text: 'Which river was crucial to the development of Ancient Egyptian civilization?',
        choices: [
          { text: 'The Tigris', correct: false },
          { text: 'The Nile River', correct: true },
          { text: 'The Amazon', correct: false },
          { text: 'The Mississippi', correct: false }
        ],
        explanation: 'The Nile River was essential to Ancient Egypt. Its annual floods deposited rich soil for farming, and the river provided water, transportation, and food.'
      }
    ];
    const q = historyQuestions[difficulty % historyQuestions.length];
    return { type: 'question', ...q, choices: q.choices.sort(() => Math.random() - 0.5), xp: 20 + (difficulty * 10) };
  }
  
  // Science fallbacks
  if (topicLower.includes('science') || topicLower.includes('biology') || topicLower.includes('chemistry') || topicLower.includes('physics')) {
    const scienceQuestions = [
      {
        text: 'What is the chemical symbol for water?',
        choices: [
          { text: 'O2', correct: false },
          { text: 'H2O', correct: true },
          { text: 'CO2', correct: false },
          { text: 'NaCl', correct: false }
        ],
        explanation: 'Water is H2O - two hydrogen atoms bonded to one oxygen atom. This molecular structure gives water its unique properties.'
      },
      {
        text: 'What gas do plants absorb from the atmosphere during photosynthesis?',
        choices: [
          { text: 'Oxygen', correct: false },
          { text: 'Carbon dioxide', correct: true },
          { text: 'Nitrogen', correct: false },
          { text: 'Hydrogen', correct: false }
        ],
        explanation: 'Plants absorb carbon dioxide (CO2) from the air and use sunlight to convert it into glucose (food) and release oxygen.'
      },
      {
        text: 'What is the powerhouse of the cell?',
        choices: [
          { text: 'Nucleus', correct: false },
          { text: 'Mitochondria', correct: true },
          { text: 'Ribosome', correct: false },
          { text: 'Cell membrane', correct: false }
        ],
        explanation: 'Mitochondria are called the powerhouse of the cell because they convert glucose into ATP (energy) that the cell can use.'
      }
    ];
    const q = scienceQuestions[difficulty % scienceQuestions.length];
    return { type: 'question', ...q, choices: q.choices.sort(() => Math.random() - 0.5), xp: 20 + (difficulty * 10) };
  }
  
  // Mathematics fallbacks
  if (topicLower.includes('math') || topicLower.includes('mathematics') || topicLower.includes('geometry') || topicLower.includes('algebra')) {
    const mathQuestions = [
      {
        text: 'What is the value of Pi (π) to two decimal places?',
        choices: [
          { text: '3.12', correct: false },
          { text: '3.14', correct: true },
          { text: '3.16', correct: false },
          { text: '3.18', correct: false }
        ],
        explanation: 'Pi (π) is approximately 3.14159... It represents the ratio of a circle\'s circumference to its diameter.'
      },
      {
        text: 'How many degrees are in a right angle?',
        choices: [
          { text: '45', correct: false },
          { text: '90', correct: true },
          { text: '180', correct: false },
          { text: '360', correct: false }
        ],
        explanation: 'A right angle is exactly 90 degrees. This forms a square corner like the corner of a piece of paper.'
      },
      {
        text: 'What is the area of a rectangle with length 5 and width 3?',
        choices: [
          { text: '8', correct: false },
          { text: '15', correct: true },
          { text: '16', correct: false },
          { text: '12', correct: false }
        ],
        explanation: 'Area of a rectangle = length × width = 5 × 3 = 15 square units.'
      }
    ];
    const q = mathQuestions[difficulty % mathQuestions.length];
    return { type: 'question', ...q, choices: q.choices.sort(() => Math.random() - 0.5), xp: 20 + (difficulty * 10) };
  }
  
  // Geography fallbacks
  if (topicLower.includes('geography') || topicLower.includes('geography')) {
    const geoQuestions = [
      {
        text: 'What is the longest river in the world?',
        choices: [
          { text: 'Amazon River', correct: false },
          { text: 'Nile River', correct: true },
          { text: 'Yangtze River', correct: false },
          { text: 'Mississippi River', correct: false }
        ],
        explanation: 'The Nile River in Africa is generally considered the longest river at about 6,650 km.'
      },
      {
        text: 'Which continent is the largest by land area?',
        choices: [
          { text: 'Africa', correct: false },
          { text: 'Asia', correct: true },
          { text: 'North America', correct: false },
          { text: 'Europe', correct: false }
        ],
        explanation: 'Asia is the largest continent, covering about 30% of Earth\'s land area.'
      }
    ];
    const q = geoQuestions[difficulty % geoQuestions.length];
    return { type: 'question', ...q, choices: q.choices.sort(() => Math.random() - 0.5), xp: 20 + (difficulty * 10) };
  }
  
  // Generic fallback (last resort - still factual!)
  console.log(`⚠️ Using generic fallback for topic: ${topic}`);
  return {
    type: 'question',
    text: `Which of these is most associated with ${topic}?`,
    choices: [
      { text: 'Paris', correct: false },
      { text: 'Einstein', correct: false },
      { text: topic === 'History' ? 'Ancient Rome' : topic === 'Science' ? 'The atom' : 'The number 7', correct: true },
      { text: 'Shakespeare', correct: false }
    ].sort(() => Math.random() - 0.5),
    explanation: `This question tests basic knowledge about ${topic}.`,
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
// STUDY BUDDY - SOCRATIC METHOD (No direct answers)
// ============================================
const chatWithStudyBuddySocratic = async (message, conversationHistory, userContext, mediaContent = []) => {
  const tierExtra = userContext.ageTier
    ? `\n- Form Level: ${userContext.formLevel || 'unknown'}\n- Age Tier: ${userContext.ageTier}\nAdjust your language complexity to match their age group.`
    : '';

  // Determine if we should give direct answer based on hint count
  const shouldGiveDirectAnswer = userContext.recentHintCount >= 3;
  const isHomeworkRequest = userContext.isHomeworkRequest;
  const hasUrls = userContext.hasUrls;
  const urls = userContext.urls || [];

  // Build the Socratic prompt
  let socraticInstruction = '';
  
  if (isHomeworkRequest && !shouldGiveDirectAnswer) {
    // STRONG SOCRATIC MODE - Guide without giving answer
    socraticInstruction = `
🚫 IMPORTANT - SOCRATIC TEACHING MODE:
The student is asking for help with what appears to be homework or a direct answer.
DO NOT give the direct answer. Instead:

1. Acknowledge their question warmly
2. Ask them what they already know or have tried
3. Give a SMALL hint or ask a guiding question
4. Break the problem into smaller steps
5. Encourage them to think through it

EXAMPLE RESPONSES:
- "That's a great question! What have you tried so far?"
- "Let's think about this together. What do you know about [concept]?"
- "Here's a small hint: [hint]. Can you try from there?"
- "Break this into steps. What's the first thing you need to find?"

NEVER say "The answer is..." or give the complete solution.`;
  } else if (shouldGiveDirectAnswer && isHomeworkRequest) {
    // ESCALATION MODE - They've asked 3+ times, provide answer with explanation
    socraticInstruction = `
⚠️ ESCALATION MODE - Student has asked ${userContext.recentHintCount} times about similar topic.
You may NOW provide the answer, BUT:
1. First acknowledge their persistence
2. Give the answer clearly
3. Explain WHY it's the answer (the reasoning)
4. Give a similar practice problem to reinforce learning`;
  }

  // URL handling instruction
  let urlInstruction = '';
  if (hasUrls) {
    urlInstruction = `
📎 URL DETECTED: The user shared these links: ${urls.join(', ')}
If you can analyze web content, reference information from these URLs.
If you cannot access URLs, ask the user to share the key content from the page.`;
  }

  // Media handling instruction
  let mediaInstruction = '';
  if (mediaContent && mediaContent.length > 0) {
    const imageCount = mediaContent.filter(m => m.type === 'image_url').length;
    const videoCount = mediaContent.filter(m => m.type === 'video_url').length;
    mediaInstruction = `
📸 MEDIA ATTACHED: ${imageCount} image(s), ${videoCount} video(s)
Analyze the media content and reference specific details in your response.
If it's a homework problem in the image, use SOCRATIC method - guide, don't just answer.`;
  }

  const systemPrompt = `You are "Study Buddy", a wise and encouraging AI tutor who uses the Socratic method.

📚 TEACHING PHILOSOPHY:
- Guide students to discover answers themselves
- Ask questions more than giving answers
- Praise effort and thinking process
- Break complex problems into steps
- Only give direct answers after student has tried multiple times (3+ attempts)

👤 STUDENT CONTEXT:
- Name: ${userContext.full_name || 'Student'}
- Level: ${userContext.level || 1}
- Streak: ${userContext.current_streak || 0} days
- Recent attempts on similar topic: ${userContext.recentHintCount || 0}
${tierExtra}

${socraticInstruction}
${urlInstruction}
${mediaInstruction}

💬 RESPONSE STYLE:
- Keep responses concise (3-5 sentences max)
- Use emojis to be friendly
- Encourage growth mindset
- If student seems frustrated, be extra supportive`;

  // Build messages array
  const validHistory = conversationHistory
    .slice(-10)
    .filter(msg => msg && msg.role && msg.content && typeof msg.content === 'string')
    .map(msg => ({ role: msg.role, content: msg.content.trim() }));

  const messages = [{ role: 'system', content: systemPrompt }];
  
  // Add media content if present
  if (mediaContent && mediaContent.length > 0) {
    const content = [
      { type: 'text', text: message || 'Please analyze this content:' }
    ];
    
    for (const media of mediaContent.slice(0, 5)) { // Limit to 5 media items
      if (media.type === 'image_url' && media.image_url) {
        content.push({ type: 'image_url', image_url: media.image_url });
      }
    }
    
    messages.push({ role: 'user', content });
  } else {
    messages.push(...validHistory);
    messages.push({ role: 'user', content: message });
  }

  try {
    console.log('🚀 Calling Kimi API for Socratic chat with thinking...');
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages,
      max_tokens: 2000,
      thinking: { type: 'enabled' }
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ Kimi API error:', error.message);
    return shouldGiveDirectAnswer 
      ? "I've guided you through this a few times. Let me explain the answer now..."
      : "That's a great question! What have you tried so far? Let's work through this together. 🤔";
  }
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
// GENERATE EXERCISES - MISSION 43 FIX (Token Limit + Reasoning Detection)
// ============================================
async function generateExercises(prompt, retries = 3) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY missing');
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, 3000));
      }

      console.log(`📝 Calling Kimi API (attempt ${attempt + 1})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      // FIX MISSION 45: Increase to 8000 tokens to handle heavy reasoning + full JSON
      console.log(`⚠️ Using 8000 max_tokens for exercise generation (reasoning + JSON)`);
      
      const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'kimi-k2.5',
          messages: [{ 
            role: 'user', 
            content: prompt + "\n\nImportant: Generate compact JSON output directly without lengthy explanation." 
          }],
          max_tokens: 8000  // FIX MISSION 45: 4000→8000 (handles 7000+ chars reasoning + 2000+ chars JSON)
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`📡 HTTP Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 RAW RESPONSE:', JSON.stringify(data).substring(0, 800));
      
      // Check finish reason
      const finishReason = data.choices?.[0]?.finish_reason;
      const message = data.choices?.[0]?.message;
      
      console.log(`🔍 Finish reason: ${finishReason}`);
      console.log(`🔍 Has reasoning_content: ${!!message?.reasoning_content}`);
      console.log(`🔍 Content length: ${message?.content?.length || 0}`);

      // Handle length limit hit
      if (finishReason === 'length') {
        console.error('⚠️ Token limit hit! Model ran out of tokens.');
        console.error(`Reasoning used: ${message?.reasoning_content?.length || 0} chars`);
        
        // EMERGENCY FALLBACK: If reasoning exists but content is empty
        if (!message?.content && message?.reasoning_content) {
          throw new Error('Token limit: Model thought too much, no output generated. Increase max_tokens or simplify prompt.');
        }
      }

      if (!message?.content || message.content.trim() === '') {
        // If content empty but reasoning has data, something is wrong with model config
        if (message?.reasoning_content) {
          console.error('🤔 Reasoning content exists but no content - model is in thinking mode');
          throw new Error('Empty content: Model is reasoning instead of outputting JSON');
        }
        throw new Error('Invalid response: content is empty');
      }

      const content = message.content;
      console.log(`✅ SUCCESS! Content: ${content.length} chars`);
      console.log(`📝 Preview: ${content.substring(0, 200)}...`);

      return content.replace(/```json\n?/gi, '').replace(/```\n?/g, '');

    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      if (attempt === retries - 1) throw error;
    }
  }
}

// ============================================
// ANALYZE DOCUMENT IMAGE - With Retry & Compression (MISSION 50)
// ============================================
async function analyzeDocumentImage(images, mimeType = 'image/jpeg') {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY missing');
  
  // Support single image or array of images
  const imageArray = Array.isArray(images) ? images : [images];
  console.log(`🖼️ Processing ${imageArray.length} image(s)...`);
  
  // Helper to compress image if sharp is available
  async function compressImage(base64String, targetMimeType) {
    try {
      // Try to use sharp if available
      const sharp = require('sharp');
      const buffer = Buffer.from(base64String, 'base64');
      const originalSize = base64String.length;
      
      const resized = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const compressed = resized.toString('base64');
      console.log(`📉 Compressed image: ${originalSize} → ${compressed.length} chars (${Math.round((1 - compressed.length/originalSize) * 100)}% reduction)`);
      return compressed;
    } catch (e) {
      // Sharp not available or compression failed, return original
      return base64String;
    }
  }
  
  // Process images (compress if possible, limit to 3)
  const processedImages = [];
  for (const img of imageArray.slice(0, 3)) {
    const compressed = await compressImage(img, mimeType);
    processedImages.push(compressed);
  }
  
  // Determine content type prefix
  const contentType = mimeType === 'image/png' ? 'image/png' : 
                      mimeType === 'image/webp' ? 'image/webp' :
                      'image/jpeg';
  
  // Build message content with text + all images
  const content = [
    {
      type: 'text',
      text: `Analyze this image document and extract information about the exercises.

Please analyze the provided image(s) and return ONLY valid JSON in this format:
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
1. Look at the image carefully and read all visible text
2. Identify the subject area from the content (Math, English, Chinese, Science, etc.)
3. Identify the specific concept or skill being tested
4. Extract as many exercises as you can see in the image
5. Determine the difficulty level based on the content complexity

IMPORTANT: If the image contains Chinese text with mathematical calculations (numbers, equations, word problems), detect subject as 'Mathematics' and language as 'Chinese'. Do not default to English.

Return ONLY valid JSON, no markdown, no explanations.`
    }
  ];
  
  // Add all processed images to content
  processedImages.forEach((img, i) => {
    console.log(`📎 Attaching image ${i + 1}: ${img.length} chars`);
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${contentType};base64,${img}`
      }
    });
  });

  // Retry logic for connection errors (ECONNRESET, etc.)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🚀 API attempt ${attempt}/3...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout for large uploads
      
      const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'kimi-k2.5',
          messages: [{
            role: 'user',
            content: content
          }],
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`📡 HTTP Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Raw response:', JSON.stringify(data).substring(0, 500));
      
      // Check finish reason
      const finishReason = data.choices?.[0]?.finish_reason;
      const message = data.choices?.[0]?.message;
      
      console.log(`🔍 Finish reason: ${finishReason}`);
      console.log(`🔍 Content length: ${message?.content?.length || 0}`);

      if (finishReason === 'length') {
        console.error('⚠️ Token limit hit!');
      }

      if (!message?.content || message.content.trim() === '') {
        throw new Error('Invalid response: content is empty');
      }

      const result = message.content;
      console.log(`✅ Document analysis complete: ${result.length} chars`);
      
      // Clean markdown and return
      return result.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

    } catch (error) {
      // Check if this is a retryable error
      const isRetryable = error.code === 'ECONNRESET' || 
                         error.code === 'ECONNABORTED' ||
                         error.code === 'ETIMEDOUT' ||
                         error.message?.includes('fetch failed') ||
                         error.message?.includes('aborted') ||
                         error.message?.includes('socket hang up');
      
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // If last attempt or non-retryable error, throw
      if (attempt === 3 || !isRetryable) {
        throw error;
      }
      
      // Exponential backoff: 3s, 6s, 9s
      const delay = attempt * 3000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  chatWithStudyBuddy,
  chatWithStudyBuddySocratic,
  sendMessageToKimi,
  generateExercises,  // ADDED: Exercise generation function
  analyzeDocumentImage,  // MISSION 48: Added image analysis function
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
