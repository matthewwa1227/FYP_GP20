const OpenAI = require('openai');

// Debug: Check if API key is loaded
console.log('🔑 Kimi API Key loaded:', process.env.KIMI_API_KEY ? 'Yes (length: ' + process.env.KIMI_API_KEY.length + ')' : 'NO - MISSING!');

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1'
});

// Study Buddy Chat
const chatWithStudyBuddy = async (message, conversationHistory, userContext) => {
  const systemPrompt = `你是 "Study Buddy"，一個友善且積極的 AI 學習夥伴。你的特點：
- 鼓勵性和正面，但不過於浮誇
- 知識豐富但解釋簡單易懂
- 理解學習的困難和壓力
- 提供實用的建議

用戶背景資料：
- 姓名：${userContext.full_name || '同學'}
- 等級：${userContext.level || 1}
- 經驗值：${userContext.xp || 0}
- 連續學習天數：${userContext.current_streak || 0} 天
- 已完成任務：${userContext.completed_tasks || 0}
- 待完成任務：${userContext.pending_tasks || 0}
- 今日學習時間：${userContext.today_study_minutes || 0} 分鐘

規則：
1. 回應簡潔（通常 2-4 句）
2. 適時引用用戶數據來激勵
3. 提供具體、可行的建議
4. 可以使用表情符號但不要過多
5. 如果用戶看起來有壓力，先理解他們的感受
6. 回答學術問題時，用例子清楚解釋
7. 用戶用什麼語言問，就用什麼語言回答（中文或英文）`;

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
    console.log('📝 Message:', message);
    
    const completion = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages,
      max_tokens: 500
      // Note: kimi-k2.5 only allows temperature=1 (default), so we don't set it
    });

    console.log('✅ Kimi API response received');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ Kimi API error:', error.message);
    console.error('❌ Error status:', error.status);
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    
    const fallbacks = [
      "我暫時連接不上，請稍後再試！🔄",
      "I'm having a brief connection issue. Try again in a moment! 🔄"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};

// Generate Study Schedule
const generateStudySchedule = async ({ tasks, studyPatterns, existingEvents, preferences, dateRange }) => {
  const now = new Date();
  const systemPrompt = `你是一個專業的學習計劃優化器。根據用戶的任務、學習模式和時間偏好，創建最優的學習計劃。

必須返回以下 JSON 格式（不要返回其他內容）：
{
  "sessions": [
    {
      "taskId": 數字或null,
      "title": "標題字符串",
      "startTime": "ISO 日期時間格式",
      "endTime": "ISO 日期時間格式",
      "description": "描述字符串",
      "type": "study"
    }
  ],
  "summary": "計劃概述",
  "tips": ["建議1", "建議2", "建議3"]
}

規則：
- 每 25-30 分鐘安排 5-10 分鐘休息
- 每 2 小時安排較長休息
- 優先處理高優先級和截止日期較近的任務
- 在用戶最佳專注時間安排困難任務
- 單次學習不超過 2 小時
- 使用 24 小時制（如 14:00）
- 所有時間必須是未來時間（現在是 ${now.toISOString()}）`;

  const userPrompt = `從今天開始創建 ${dateRange} 天的學習計劃。

待安排的任務：
${JSON.stringify(tasks, null, 2)}

用戶最佳學習時間（按專注度排序）：
${JSON.stringify(studyPatterns.slice(0, 10), null, 2)}

已有的安排（需要避開）：
${JSON.stringify(existingEvents, null, 2)}

用戶偏好：
${JSON.stringify(preferences, null, 2)}

請生成優化的學習計劃，只返回 JSON。`;

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
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('❌ Schedule generation error:', error.message);
    return generateFallbackSchedule(tasks, dateRange);
  }
};

// Fallback schedule (no AI)
const generateFallbackSchedule = (tasks, dateRange) => {
  const sessions = [];
  const now = new Date();
  
  tasks.slice(0, 10).forEach((task, index) => {
    const sessionDate = new Date(now);
    sessionDate.setDate(sessionDate.getDate() + Math.floor(index / 3) + 1);
    sessionDate.setHours(9 + (index % 3) * 3, 0, 0, 0);
    
    const endDate = new Date(sessionDate);
    endDate.setMinutes(endDate.getMinutes() + (task.estimated_duration || 45));
    
    sessions.push({
      taskId: task.id,
      title: `學習: ${task.title}`,
      startTime: sessionDate.toISOString(),
      endTime: endDate.toISOString(),
      description: task.description || '專注學習時段',
      type: 'study'
    });
  });
  
  return {
    sessions,
    summary: `已根據待完成任務創建 ${sessions.length} 個學習時段。`,
    tips: [
      '在精力最充沛時處理最困難的任務',
      '每 25-30 分鐘休息一下',
      '每天結束時複習所學內容'
    ]
  };
};

// Generate Study Tips
const generateStudyTips = async ({ subject, difficulty, performance }) => {
  const systemPrompt = `你是學習專家。提供 3-5 個具體、可行的學習建議。每個建議 1-2 句話。只返回 JSON 數組格式。`;

  const userPrompt = `針對以下情況給出學習建議：
科目：${subject || '一般學習'}
難度：${difficulty || '中等'}
近期表現：${JSON.stringify(performance)}

只返回 JSON 數組，如：["建議1", "建議2", "建議3"]`;

  try {
    console.log('🚀 Calling Kimi API for study tips...');
    
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
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return getDefaultTips();
  } catch (error) {
    console.error('❌ Tips generation error:', error.message);
    return getDefaultTips();
  }
};

const getDefaultTips = () => [
  "將學習分成 25 分鐘的專注時段",
  "24 小時內複習以提高記憶",
  "用自我測試代替重複閱讀"
];

module.exports = {
  chatWithStudyBuddy,
  generateStudySchedule,
  generateStudyTips
};