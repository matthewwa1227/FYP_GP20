const OpenAI = require('openai');

// Debug: Check if API key is loaded
console.log('🔑 Kimi API Key loaded:', process.env.KIMI_API_KEY ? 'Yes (length: ' + process.env.KIMI_API_KEY.length + ')' : 'NO - MISSING!');

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
  timeout: 60000 // Increased to 60 seconds
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
    console.log('🚀 Calling Kimi API for chat...');
    
    const completion = await kimi.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages,
      max_tokens: 500,
      temperature: 0.7
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

// Generate Study Schedule - Uses smart fallback primarily for reliability
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

  // Try AI first, but with a shorter timeout and simpler prompt
  try {
    console.log('🚀 Calling Kimi API for schedule generation...');
    console.log('📝 Tasks count:', tasks.length);
    console.log('📝 Date range:', dateRange, 'days');

    const now = new Date();
    const sessionLength = preferences.sessionLength || 45;
    const breakLength = preferences.breakLength || 10;

    // Simplified prompt for faster response
    const systemPrompt = `You are a study schedule optimizer. Return ONLY valid JSON, no explanations.`;

    const userPrompt = `Create study schedule. Current time: ${now.toISOString()}

Tasks (${tasks.length}):
${tasks.slice(0, 5).map(t => `- ID:${t.id} "${t.title}" ${t.priority || 'medium'} priority, ${t.estimated_duration || 30}min`).join('\n')}

Settings: ${sessionLength}min sessions, ${breakLength}min breaks, ${preferences.preferredStartTime || '09:00'}-${preferences.preferredEndTime || '21:00'}

Return JSON:
{"sessions":[{"taskId":number,"title":"string","startTime":"ISO","endTime":"ISO","type":"study","priority":"high/medium/low"}],"summary":"string","tips":["tip1","tip2"]}`;

    // Use Promise.race for custom timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Custom timeout')), 15000)
    );

    const apiPromise = kimi.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.5
    });

    const completion = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = completion.choices[0].message.content;
    
    console.log('✅ Kimi API response received');

    // Extract JSON
    let jsonStr = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.sessions && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
        // Validate sessions
        parsed.sessions = parsed.sessions.filter(session => {
          try {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end;
          } catch {
            return false;
          }
        });

        if (parsed.sessions.length > 0) {
          console.log('✅ AI generated', parsed.sessions.length, 'valid sessions');
          return parsed;
        }
      }
    }
    
    console.log('⚠️ AI response invalid, using fallback');
    return generateSmartFallbackSchedule(tasks, dateRange, preferences);

  } catch (error) {
    console.error('❌ Schedule generation error:', error.message);
    console.log('📋 Using smart fallback scheduler...');
    return generateSmartFallbackSchedule(tasks, dateRange, preferences);
  }
};

// Smart fallback schedule generator (no AI needed) - This is actually quite good!
const generateSmartFallbackSchedule = (tasks, dateRange, preferences = {}) => {
  const sessions = [];
  const now = new Date();
  
  const sessionLength = preferences.sessionLength || 45;
  const breakLength = preferences.breakLength || 10;
  const startHour = parseInt(preferences.preferredStartTime?.split(':')[0]) || 9;
  const endHour = parseInt(preferences.preferredEndTime?.split(':')[0]) || 21;
  
  console.log('📋 Generating fallback schedule...');
  console.log(`   Sessions: ${sessionLength}min, Breaks: ${breakLength}min`);
  console.log(`   Hours: ${startHour}:00 - ${endHour}:00`);

  // Sort tasks by priority and due date
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityWeight[a.priority] || 2;
    const bPriority = priorityWeight[b.priority] || 2;
    
    const aDate = a.due_date ? new Date(a.due_date) : new Date('2099-12-31');
    const bDate = b.due_date ? new Date(b.due_date) : new Date('2099-12-31');
    
    // Sort by priority first, then due date
    if (bPriority !== aPriority) return bPriority - aPriority;
    return aDate - bDate;
  });

  // Calculate sessions per day
  const availableHours = endHour - startHour;
  const sessionWithBreak = sessionLength + breakLength;
  const maxSessionsPerDay = Math.floor((availableHours * 60) / sessionWithBreak);
  const sessionsPerDay = Math.min(maxSessionsPerDay, 4);
  
  // Start from tomorrow at preferred start time (or today if early enough)
  let currentDate = new Date(now);
  if (currentDate.getHours() >= startHour + 2) {
    // If it's past start time + 2 hours, start tomorrow
    currentDate.setDate(currentDate.getDate() + 1);
  }
  currentDate.setHours(startHour, 0, 0, 0);
  
  let dayCount = 0;
  let sessionInDay = 0;
  
  for (let i = 0; i < sortedTasks.length && dayCount < dateRange; i++) {
    const task = sortedTasks[i];
    const taskDuration = task.estimated_duration || task.estimatedMinutes || sessionLength;
    
    // Calculate how many sessions needed for this task
    const sessionsNeeded = Math.ceil(taskDuration / sessionLength);
    
    for (let s = 0; s < sessionsNeeded && dayCount < dateRange; s++) {
      // Check if we need to move to next day
      if (sessionInDay >= sessionsPerDay) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
        sessionInDay = 0;
        dayCount++;
        if (dayCount >= dateRange) break;
      }
      
      // Create study session
      const startTime = new Date(currentDate);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + sessionLength);
      
      sessions.push({
        taskId: task.id,
        title: sessionsNeeded > 1 ? `${task.title} (Part ${s + 1}/${sessionsNeeded})` : task.title,
        subject: task.subject || 'General',
        priority: task.priority || 'medium',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: task.description || `Study session for ${task.title}`,
        type: 'study'
      });
      
      // Add break after study session (except for last session of day)
      if (sessionInDay < sessionsPerDay - 1) {
        const breakStart = new Date(endTime);
        const breakEnd = new Date(breakStart);
        breakEnd.setMinutes(breakEnd.getMinutes() + breakLength);
        
        sessions.push({
          taskId: null,
          title: 'Break',
          startTime: breakStart.toISOString(),
          endTime: breakEnd.toISOString(),
          description: 'Rest and recharge',
          type: 'break'
        });
        
        // Move current time forward
        currentDate = new Date(breakEnd);
      } else {
        currentDate = new Date(endTime);
      }
      
      sessionInDay++;
      
      // Check if we've exceeded daily end time
      if (currentDate.getHours() >= endHour - 1) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(startHour, 0, 0, 0);
        sessionInDay = 0;
        dayCount++;
      }
    }
  }
  
  // Remove trailing break if exists
  if (sessions.length > 0 && sessions[sessions.length - 1].type === 'break') {
    sessions.pop();
  }
  
  const studySessions = sessions.filter(s => s.type === 'study');
  const totalMinutes = studySessions.length * sessionLength;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const daysUsed = Math.min(dayCount + 1, dateRange);
  
  console.log(`✅ Generated ${studySessions.length} study sessions across ${daysUsed} days`);
  
  // Generate contextual tips based on tasks
  const tips = generateContextualTips(sortedTasks, preferences);
  
  return {
    sessions,
    summary: `📅 Created ${studySessions.length} study sessions across ${daysUsed} days. Total study time: ${hours}h ${minutes}m. ${
      sortedTasks.filter(t => t.priority === 'high').length > 0 
        ? 'High-priority tasks scheduled first!' 
        : ''
    }`,
    tips
  };
};

// Generate contextual tips based on user's tasks
const generateContextualTips = (tasks, preferences) => {
  const tips = [];
  
  const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
  const totalTasks = tasks.length;
  const sessionLength = preferences.sessionLength || 45;
  
  if (highPriorityCount > 0) {
    tips.push(`🔥 You have ${highPriorityCount} high-priority task${highPriorityCount > 1 ? 's' : ''} - these are scheduled first!`);
  }
  
  if (sessionLength <= 30) {
    tips.push('⚡ Short sessions work great for maintaining focus. Take breaks seriously!');
  } else if (sessionLength >= 60) {
    tips.push('📚 Longer sessions are great for deep work. Stay hydrated and take stretch breaks!');
  } else {
    tips.push('⏱️ Your session length is optimal for the Pomodoro technique!');
  }
  
  if (totalTasks > 5) {
    tips.push('📋 You have many tasks - consider which ones can be delegated or postponed.');
  }
  
  tips.push('🎯 Review completed tasks at the end of each day to track progress.');
  tips.push('💪 Consistency beats intensity - stick to your schedule!');
  
  return tips.slice(0, 5);
};

// Generate Study Tips
const generateStudyTips = async ({ subject, difficulty, performance }) => {
  try {
    console.log('🚀 Calling Kimi API for study tips...');
    
    const completion = await kimi.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: 'Give 3-5 specific study tips. Return ONLY a JSON array.' },
        { role: 'user', content: `Tips for ${subject || 'General'} (${difficulty || 'Medium'} difficulty). Return: ["tip1", "tip2", "tip3"]` }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content;
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    
    if (jsonMatch) {
      const tips = JSON.parse(jsonMatch[0]);
      console.log('✅ Got', tips.length, 'tips from AI');
      return tips;
    }
    
    return getDefaultTips(subject, difficulty);
  } catch (error) {
    console.error('❌ Tips generation error:', error.message);
    return getDefaultTips(subject, difficulty);
  }
};

const getDefaultTips = (subject, difficulty) => {
  const tips = [
    "Break your study into 25-minute focused sessions (Pomodoro Technique)",
    "Review material within 24 hours to improve retention",
    "Test yourself instead of just re-reading notes",
    "Teach concepts to someone else to solidify understanding",
    "Get enough sleep - it's crucial for memory consolidation"
  ];
  
  if (difficulty === 'hard') {
    tips.unshift("Start with the most challenging material when your mind is fresh");
  }
  
  if (subject?.toLowerCase().includes('math')) {
    tips.unshift("Practice problems actively rather than just reading solutions");
  }
  
  return tips.slice(0, 5);
};

module.exports = {
  chatWithStudyBuddy,
  generateStudySchedule,
  generateStudyTips
};