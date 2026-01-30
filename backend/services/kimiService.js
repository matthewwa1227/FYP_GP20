const OpenAI = require('openai');

// Debug: Check if API key is loaded
console.log('🔑 Kimi API Key loaded:', process.env.KIMI_API_KEY ? 'Yes (length: ' + process.env.KIMI_API_KEY.length + ')' : 'NO - MISSING!');

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
  timeout: 30000 // 30 second timeout
});

// Study Buddy Chat
const chatWithStudyBuddy = async (message, conversationHistory, userContext) => {
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
- Today's Study Time: ${userContext.today_study_minutes || 0} minutes

Rules:
1. Keep responses concise (usually 2-4 sentences)
2. Reference user data to motivate them when appropriate
3. Provide specific, actionable advice
4. Use emojis sparingly but effectively
5. If user seems stressed, acknowledge their feelings first
6. When answering academic questions, explain clearly with examples
7. Respond in the same language the user uses (Chinese or English)`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    { role: 'user', content: message }
  ];

  try {
    console.log('🚀 Calling Kimi API...');
    console.log('📝 Model: kimi-k2.5');
    console.log('📝 Message:', message.substring(0, 100));
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages,
      max_tokens: 500
    });

    console.log('✅ Kimi API response received');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ Kimi API error:', error.message);
    
    const fallbacks = [
      "I'm having a brief connection issue. Try again in a moment! 🔄",
      "我暫時連接不上，請稍後再試！🔄"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

// Generate Study Schedule
const generateStudySchedule = async ({ tasks, studyPatterns, existingEvents, preferences, dateRange }) => {
  // If no tasks, return empty schedule immediately
  if (!tasks || tasks.length === 0) {
    return {
      sessions: [],
      summary: 'No pending tasks to schedule. Add some tasks first!',
      tips: [
        'Break large projects into smaller tasks',
        'Set realistic deadlines for each task',
        'Prioritize tasks by urgency and importance'
      ]
    };
  }

  const now = new Date();
  const systemPrompt = `You are a professional study schedule optimizer. Create optimal study sessions based on tasks and preferences.

Return ONLY valid JSON in this exact format:
{
  "sessions": [
    {
      "taskId": number or null,
      "title": "Session title",
      "startTime": "ISO datetime string",
      "endTime": "ISO datetime string",
      "description": "Brief description",
      "type": "study"
    }
  ],
  "summary": "Brief schedule overview",
  "tips": ["tip1", "tip2", "tip3"]
}

Rules:
- Schedule 25-50 minute study blocks
- Add 5-10 minute breaks between sessions
- Prioritize high-priority and near-deadline tasks
- All times must be in the future (now: ${now.toISOString()})
- Maximum 4-5 sessions per day
- Use 24-hour format`;

  const userPrompt = `Create a ${dateRange}-day study plan starting today.

Tasks to schedule:
${JSON.stringify(tasks.slice(0, 10), null, 2)}

User's best study times (by focus score):
${JSON.stringify(studyPatterns.slice(0, 5), null, 2)}

Existing commitments to avoid:
${JSON.stringify(existingEvents.slice(0, 10), null, 2)}

Preferences: ${JSON.stringify(preferences)}

Return ONLY the JSON, no explanations.`;

  try {
    console.log('🚀 Calling Kimi API for schedule generation...');
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000
    });

    const responseText = completion.choices[0].message.content;
    console.log('✅ Schedule response received');
    console.log('📝 Raw response:', responseText.substring(0, 200));
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Successfully parsed schedule with', parsed.sessions?.length || 0, 'sessions');
      return parsed;
    }
    
    console.log('⚠️ No JSON found in response, using fallback');
    return generateFallbackSchedule(tasks, dateRange);
  } catch (error) {
    console.error('❌ Schedule generation error:', error.message);
    return generateFallbackSchedule(tasks, dateRange);
  }
};

// Fallback schedule (no AI)
const generateFallbackSchedule = (tasks, dateRange) => {
  const sessions = [];
  const now = new Date();
  
  // Get tomorrow at 9am as starting point
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);
  
  tasks.slice(0, Math.min(10, dateRange * 3)).forEach((task, index) => {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + Math.floor(index / 3));
    sessionDate.setHours(9 + (index % 3) * 3, 0, 0, 0);
    
    const duration = task.estimated_duration || 45;
    const endDate = new Date(sessionDate);
    endDate.setMinutes(endDate.getMinutes() + duration);
    
    sessions.push({
      taskId: task.id,
      title: `Study: ${task.title}`,
      startTime: sessionDate.toISOString(),
      endTime: endDate.toISOString(),
      description: task.description || 'Focused study session',
      type: 'study'
    });
  });
  
  return {
    sessions,
    summary: `Created ${sessions.length} study sessions based on your pending tasks.`,
    tips: [
      'Tackle difficult tasks when your energy is highest',
      'Take a 5-minute break every 25-30 minutes',
      'Review what you learned at the end of each day'
    ]
  };
};

// Generate Study Tips
const generateStudyTips = async ({ subject, difficulty, performance }) => {
  const systemPrompt = `You are a learning expert. Provide 3-5 specific, actionable study tips. Each tip should be 1-2 sentences. Return ONLY a JSON array.`;

  const userPrompt = `Give study tips for:
Subject: ${subject || 'General'}
Difficulty: ${difficulty || 'Medium'}
Recent performance: ${JSON.stringify(performance || [])}

Return ONLY a JSON array like: ["tip1", "tip2", "tip3"]`;

  try {
    console.log('🚀 Calling Kimi API for study tips...');
    console.log('📝 Subject:', subject, 'Difficulty:', difficulty);
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500
    });

    const responseText = completion.choices[0].message.content;
    console.log('✅ Tips response received');
    console.log('📝 Raw response:', responseText.substring(0, 200));
    
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    
    if (jsonMatch) {
      const tips = JSON.parse(jsonMatch[0]);
      console.log('✅ Successfully parsed', tips.length, 'tips');
      return tips;
    }
    
    console.log('⚠️ No JSON array found, using defaults');
    return getDefaultTips(subject, difficulty);
  } catch (error) {
    console.error('❌ Tips generation error:', error.message);
    return getDefaultTips(subject, difficulty);
  }
};

const getDefaultTips = (subject, difficulty) => {
  const baseTips = [
    "Break your study into 25-minute focused sessions (Pomodoro Technique)",
    "Review material within 24 hours to improve retention",
    "Test yourself instead of just re-reading notes",
    "Teach concepts to someone else to solidify understanding",
    "Get enough sleep - it's crucial for memory consolidation"
  ];
  
  if (difficulty === 'hard') {
    baseTips.unshift("Start with the most challenging material when your mind is fresh");
  }
  
  if (subject === 'Math') {
    baseTips.unshift("Practice problems actively rather than just reading solutions");
  }
  
  return baseTips.slice(0, 5);
};

module.exports = {
  chatWithStudyBuddy,
  generateStudySchedule,
  generateStudyTips
};