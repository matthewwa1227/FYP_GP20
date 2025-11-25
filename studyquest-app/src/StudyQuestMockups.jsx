import React, { useState } from 'react';
import { Clock, Trophy, Target, Users, BookOpen, ChevronRight, Bell, Settings, LogOut, Home, BarChart3, Gift, Zap, Star, Award, TrendingUp, Calendar, MessageSquare, CheckCircle, XCircle, Send, Plus, Search, Filter, UserCheck, Heart, ThumbsUp, Eye } from 'lucide-react';

function StudyQuestMockups() {
  const [currentView, setCurrentView] = useState('student-dashboard');
  const [userRole, setUserRole] = useState('student');

  // Mock data
  const studentData = {
    name: 'Sarah Chen',
    level: 12,
    points: 2850,
    streak: 7,
    todayMinutes: 45,
    weeklyGoal: 600,
    weeklyProgress: 285
  };

  const subjects = [
    { name: 'Mathematics', time: 180, color: 'bg-blue-500' },
    { name: 'Physics', time: 120, color: 'bg-purple-500' },
    { name: 'Chemistry', time: 90, color: 'bg-green-500' },
    { name: 'Biology', time: 60, color: 'bg-yellow-500' }
  ];

  const allAchievements = [
    { name: 'First Session', icon: '🎯', unlocked: true, description: 'Complete your first study session', date: 'Nov 1, 2025' },
    { name: '7 Day Streak', icon: '🔥', unlocked: true, description: 'Study for 7 consecutive days', date: 'Nov 18, 2025' },
    { name: 'Night Owl', icon: '🦉', unlocked: true, description: 'Study after 10 PM', date: 'Nov 10, 2025' },
    { name: 'Early Bird', icon: '🌅', unlocked: true, description: 'Study before 7 AM', date: 'Nov 5, 2025' },
    { name: 'Century Club', icon: '💯', unlocked: false, description: 'Study for 100 hours total', progress: 65 },
    { name: 'Team Player', icon: '🤝', unlocked: false, description: 'Join 5 study groups', progress: 2 },
    { name: 'Subject Master', icon: '📚', unlocked: false, description: 'Study one subject for 50 hours', progress: 35 },
    { name: 'Speed Demon', icon: '⚡', unlocked: false, description: 'Complete 10 sessions in one day', progress: 0 },
    { name: 'Marathon Runner', icon: '🏃', unlocked: false, description: 'Study for 6 hours straight', progress: 0 },
    { name: 'Social Butterfly', icon: '🦋', unlocked: false, description: 'Make 10 study friends', progress: 6 }
  ];

  const leaderboard = [
    { rank: 1, name: 'Alex Kumar', points: 4200, avatar: '👨' },
    { rank: 2, name: 'Emma Watson', points: 3950, avatar: '👩' },
    { rank: 3, name: 'Sarah Chen', points: 2850, avatar: '👧', isMe: true },
    { rank: 4, name: 'John Doe', points: 2700, avatar: '👦' },
    { rank: 5, name: 'Lisa Park', points: 2500, avatar: '👩' }
  ];

  const allChallenges = [
    { id: 1, title: 'Study 120 minutes today', progress: 45, goal: 120, points: 50, type: 'daily', timeLeft: '8 hours', category: 'Time' },
    { id: 2, title: 'Complete 5 sessions this week', progress: 3, goal: 5, points: 100, type: 'weekly', timeLeft: '3 days', category: 'Consistency' },
    { id: 3, title: 'Master Mathematics', progress: 180, goal: 300, points: 200, type: 'subject', timeLeft: '14 days', category: 'Subject Focus' },
    { id: 4, title: 'Maintain 10-day streak', progress: 7, goal: 10, points: 150, type: 'streak', timeLeft: '3 days', category: 'Consistency' },
    { id: 5, title: 'Join 3 study groups', progress: 1, goal: 3, points: 75, type: 'social', timeLeft: '7 days', category: 'Social' },
    { id: 6, title: 'Study before 8 AM twice', progress: 0, goal: 2, points: 80, type: 'time-based', timeLeft: '5 days', category: 'Time Challenge' }
  ];

  const studyGroups = [
    { name: 'Math Wizards', members: 12, subject: 'Mathematics', activeNow: 3, level: 'Advanced' },
    { name: 'Physics Squad', members: 8, subject: 'Physics', activeNow: 1, level: 'Intermediate' },
    { name: 'Chemistry Club', members: 15, subject: 'Chemistry', activeNow: 5, level: 'Beginner' },
    { name: 'Night Owls', members: 20, subject: 'Mixed', activeNow: 7, level: 'All Levels' }
  ];

  const friends = [
    { name: 'Alex Kumar', status: 'online', studying: 'Mathematics', streak: 15, avatar: '👨' },
    { name: 'Emma Watson', status: 'online', studying: 'Physics', streak: 12, avatar: '👩' },
    { name: 'John Doe', status: 'offline', studying: null, streak: 8, avatar: '👦' },
    { name: 'Lisa Park', status: 'online', studying: 'Chemistry', streak: 10, avatar: '👩' }
  ];

  // Navigation Component
  const Navigation = ({ role }) => {
    const studentNav = [
      { id: 'student-dashboard', label: 'Dashboard', icon: Home },
      { id: 'student-study', label: 'Study Session', icon: Clock },
      { id: 'student-achievements', label: 'Achievements', icon: Award },
      { id: 'student-leaderboard', label: 'Leaderboard', icon: Trophy },
      { id: 'student-challenges', label: 'Challenges', icon: Target },
      { id: 'student-social', label: 'Social', icon: Users }
    ];

    const parentNav = [
      { id: 'parent-dashboard', label: 'Dashboard', icon: Home },
      { id: 'parent-children', label: 'My Children', icon: Users },
      { id: 'parent-analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'parent-goals', label: 'Goals & Rewards', icon: Target },
      { id: 'parent-verify', label: 'Verify Sessions', icon: CheckCircle }
    ];

    const teacherNav = [
      { id: 'teacher-dashboard', label: 'Dashboard', icon: Home },
      { id: 'teacher-students', label: 'Students', icon: Users },
      { id: 'teacher-challenges', label: 'Class Challenges', icon: Target },
      { id: 'teacher-analytics', label: 'Class Analytics', icon: BarChart3 }
    ];

    const navItems = role === 'student' ? studentNav : role === 'parent' ? parentNav : teacherNav;

    return (
      <div className="bg-white border-r border-gray-200 w-64 h-screen flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-indigo-600">StudyQuest</h1>
          <p className="text-sm text-gray-500 mt-1">{role.charAt(0).toUpperCase() + role.slice(1)} Portal</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    );
  };

  // Student Dashboard
  const StudentDashboard = () => (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome back, {studentData.name}!</h2>
          <p className="text-gray-500 mt-1">Ready to level up your learning?</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm">Current Level</p>
              <p className="text-4xl font-bold mt-2">{studentData.level}</p>
            </div>
            <Star className="w-12 h-12 text-indigo-200" />
          </div>
          <div className="mt-4 bg-white bg-opacity-20 rounded-full h-2">
            <div className="bg-white rounded-full h-2 w-3/4"></div>
          </div>
          <p className="text-sm text-indigo-100 mt-2">750 XP to Level 13</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Points</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{studentData.points}</p>
            </div>
            <Trophy className="w-10 h-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Current Streak</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{studentData.streak}</p>
            </div>
            <div className="text-4xl">🔥</div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Days in a row!</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Today's Study</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{studentData.todayMinutes}m</p>
            </div>
            <Clock className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Progress</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Study Goal: {studentData.weeklyGoal} minutes</span>
              <span className="font-semibold text-indigo-600">{studentData.weeklyProgress}/{studentData.weeklyGoal} min</span>
            </div>
            <div className="bg-gray-100 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full h-4"
                style={{ width: `${(studentData.weeklyProgress / studentData.weeklyGoal) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <div key={day} className="text-center">
                <p className="text-xs text-gray-500 mb-2">{day}</p>
                <div className={`h-24 rounded-lg ${i < 4 ? 'bg-indigo-500' : i === 4 ? 'bg-indigo-300' : 'bg-gray-100'}`}>
                  {i < 5 && (
                    <div className="h-full flex items-end justify-center pb-2">
                      <span className="text-xs text-white font-semibold">{[60, 45, 75, 50, 45][i]}m</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Breakdown</h3>
          <div className="space-y-3">
            {subjects.map(subject => (
              <div key={subject.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{subject.name}</span>
                  <span className="font-semibold text-gray-900">{subject.time}m</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div 
                    className={`${subject.color} rounded-full h-2`}
                    style={{ width: `${(subject.time / 180) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Challenges</h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {allChallenges.slice(0, 3).map((challenge) => (
              <div key={challenge.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{challenge.title}</h4>
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                    +{challenge.points} pts
                  </span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 mb-2">
                  <div 
                    className="bg-indigo-500 rounded-full h-2"
                    style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">{challenge.progress}/{challenge.goal}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Achievements</h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {allAchievements.slice(0, 6).map((achievement, i) => (
              <div 
                key={i}
                className={`text-center p-4 rounded-lg border-2 ${
                  achievement.unlocked 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">{achievement.icon}</div>
                <p className="text-xs font-medium text-gray-900">{achievement.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Student Study Session
  const StudentStudySession = () => {
    const [isStudying, setIsStudying] = useState(false);
    const [timer, setTimer] = useState(0);
    const [selectedSubject, setSelectedSubject] = useState('Mathematics');

    return (
      <div className="p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Study Session</h2>
        
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-12 text-white text-center">
            <div className="text-8xl font-bold mb-6">
              {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
            </div>
            
            <div className="mb-8">
              <label className="block text-sm text-indigo-100 mb-2">Subject</label>
              <select 
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg px-4 py-3 text-white w-full max-w-xs"
                disabled={isStudying}
              >
                <option>Mathematics</option>
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Biology</option>
                <option>English</option>
              </select>
            </div>

            <button
              onClick={() => setIsStudying(!isStudying)}
              className={`px-12 py-4 rounded-xl font-semibold text-lg transition-all ${
                isStudying
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {isStudying ? 'Stop Session' : 'Start Studying'}
            </button>

            {isStudying && (
              <div className="mt-8 bg-white bg-opacity-10 rounded-lg p-4">
                <p className="text-sm text-indigo-100">Earning points: <span className="font-bold">+1 per minute</span></p>
              </div>
            )}
          </div>

          <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Notes (Optional)</h3>
            <textarea
              placeholder="What did you study today? Any key learnings?"
              className="w-full border border-gray-300 rounded-lg p-4 h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            ></textarea>
          </div>

          <div className="mt-6 bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Sessions</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Mathematics</p>
                  <p className="text-sm text-gray-500">9:00 AM - 9:45 AM</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">45 minutes</p>
                  <p className="text-sm text-green-600">+45 points</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Student Achievements (NEW)
  const StudentAchievements = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Achievements</h2>
          <p className="text-gray-500 mt-1">Track your milestones and unlock badges</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Unlocked</p>
          <p className="text-2xl font-bold text-indigo-600">{allAchievements.filter(a => a.unlocked).length}/{allAchievements.length}</p>
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">All</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Unlocked</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Locked</button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {allAchievements.map((achievement, i) => (
          <div 
            key={i}
            className={`bg-white rounded-xl p-6 border-2 ${
              achievement.unlocked 
                ? 'border-yellow-400 shadow-lg' 
                : 'border-gray-200 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-6xl">{achievement.icon}</div>
              {achievement.unlocked ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-400 text-xs">🔒</span>
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{achievement.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{achievement.description}</p>
            {achievement.unlocked ? (
              <p className="text-xs text-green-600 font-medium">Unlocked on {achievement.date}</p>
            ) : (
              <div>
                <div className="bg-gray-100 rounded-full h-2 mb-2">
                  <div 
                    className="bg-indigo-500 rounded-full h-2"
                    style={{ width: `${achievement.progress || 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">{achievement.progress || 0}% complete</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Student Leaderboard
  const StudentLeaderboard = () => (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Leaderboard</h2>

      <div className="flex space-x-4 mb-6">
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">Global</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Friends</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">My Class</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {leaderboard.map((user, i) => (
          <div 
            key={i}
            className={`flex items-center justify-between p-6 border-b border-gray-200 ${
              user.isMe ? 'bg-indigo-50' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                user.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                user.rank === 2 ? 'bg-gray-300 text-gray-800' :
                user.rank === 3 ? 'bg-orange-400 text-orange-900' :
                'bg-gray-100 text-gray-600'
              }`}>
                {user.rank}
              </div>
              <div className="text-3xl">{user.avatar}</div>
              <div>
                <p className="font-semibold text-gray-900">{user.name} {user.isMe && '(You)'}</p>
                <p className="text-sm text-gray-500">Level {Math.floor(user.points / 250)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{user.points}</p>
              <p className="text-sm text-gray-500">points</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Student Challenges (NEW)
  const StudentChallenges = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Challenges</h2>
          <p className="text-gray-500 mt-1">Complete challenges to earn extra points</p>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">All</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Daily</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Weekly</button>
        <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Subject</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {allChallenges.map((challenge) => (
          <div key={challenge.id} className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-indigo-400 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full">
                  {challenge.category}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-3">{challenge.title}</h3>
              </div>
              <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-3 py-2 rounded-lg">
                +{challenge.points} pts
              </span>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Progress</span>
                <span className="font-semibold text-gray-900">{challenge.progress}/{challenge.goal}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full h-3"
                  style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{challenge.timeLeft} left</span>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Student Social (NEW)
  const StudentSocial = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Social Hub</h2>
          <p className="text-gray-500 mt-1">Connect with friends and join study groups</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Study Groups</h3>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {studyGroups.map((group, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">{group.name}</h4>
                      <p className="text-sm text-gray-500">{group.subject} • {group.level}</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                      {group.activeNow} studying now
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{group.members} members</span>
                    </div>
                    <button className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50">
                      Join Group
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">👨</div>
                <div className="flex-1">
                  <p className="text-sm"><span className="font-semibold">Alex Kumar</span> completed the <span className="font-semibold">Study Marathon</span> challenge</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
                <ThumbsUp className="w-5 h-5 text-gray-400 hover:text-indigo-600 cursor-pointer" />
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">👩</div>
                <div className="flex-1">
                  <p className="text-sm"><span className="font-semibold">Emma Watson</span> achieved a <span className="font-semibold">14-day streak</span></p>
                  <p className="text-xs text-gray-500">5 hours ago</p>
                </div>
                <Heart className="w-5 h-5 text-gray-400 hover:text-red-500 cursor-pointer" />
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">👦</div>
                <div className="flex-1">
                  <p className="text-sm"><span className="font-semibold">John Doe</span> joined <span className="font-semibold">Math Wizards</span> study group</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Friends</h3>
              <button className="text-indigo-600 hover:text-indigo-700">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {friends.map((friend, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="text-2xl">{friend.avatar}</div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                      }`}></div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{friend.name}</p>
                      {friend.studying ? (
                        <p className="text-xs text-green-600">Studying {friend.studying}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Offline</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{friend.streak}🔥</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Invite Friends</h3>
            <p className="text-sm text-indigo-100 mb-4">Get 100 points for each friend who joins!</p>
            <button className="w-full px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50">
              Send Invites
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Parent Dashboard
  const ParentDashboard = () => {
    const children = [
      { name: 'Sarah Chen', age: 15, level: 12, streak: 7, weeklyMins: 285, avatar: '👧' },
      { name: 'David Chen', age: 13, level: 8, streak: 3, weeklyMins: 180, avatar: '👦' }
    ];

    return (
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Children's Progress</h2>
          <p className="text-gray-500 mt-1">Monitor and support your children's learning journey</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {children.map((child, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border-2 border-indigo-200 hover:border-indigo-400 cursor-pointer transition-colors">
              <div className="flex items-center space-x-4 mb-6">
                <div className="text-5xl">{child.avatar}</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{child.name}</h3>
                  <p className="text-gray-500">{child.age} years old</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-600">{child.level}</p>
                  <p className="text-xs text-gray-600">Level</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{child.streak}</p>
                  <p className="text-xs text-gray-600">Day Streak</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{child.weeklyMins}</p>
                  <p className="text-xs text-gray-600">Min/Week</p>
                </div>
              </div>

              <button className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                View Details
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pending Verifications</h3>
              <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">3</span>
            </div>
            <button className="w-full px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50">
              Review Sessions
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reward Requests</h3>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">2</span>
            </div>
            <button className="w-full px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50">
              View Requests
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
              Send Encouragement
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Parent Children (NEW)
  const ParentChildren = () => {
    const children = [
      { name: 'Sarah Chen', age: 15, level: 12, streak: 7, weeklyMins: 285, avatar: '👧', grade: '10th', school: 'Lincoln High' },
      { name: 'David Chen', age: 13, level: 8, streak: 3, weeklyMins: 180, avatar: '👦', grade: '8th', school: 'Lincoln Middle' }
    ];

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">My Children</h2>
            <p className="text-gray-500 mt-1">Manage and monitor your children's accounts</p>
          </div>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Child</span>
          </button>
        </div>

        <div className="space-y-6">
          {children.map((child, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="text-6xl">{child.avatar}</div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{child.name}</h3>
                    <p className="text-gray-500">{child.age} years old • {child.grade} Grade</p>
                    <p className="text-sm text-gray-400">{child.school}</p>
                  </div>
                </div>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                  Edit Profile
                </button>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <p className="text-3xl font-bold text-indigo-600">{child.level}</p>
                  <p className="text-sm text-gray-600 mt-1">Level</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">{child.streak}</p>
                  <p className="text-sm text-gray-600 mt-1">Day Streak</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{child.weeklyMins}</p>
                  <p className="text-sm text-gray-600 mt-1">Weekly Mins</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">12</p>
                  <p className="text-sm text-gray-600 mt-1">Achievements</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">2850</p>
                  <p className="text-sm text-gray-600 mt-1">Total Points</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  View Full Report
                </button>
                <button className="flex-1 px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50">
                  Set Goals
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                  Send Message
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Parent Analytics
  const ParentAnalytics = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Analytics - Sarah Chen</h2>
          <p className="text-gray-500 mt-1">Detailed insights into study patterns</p>
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg">
          <option>Last 7 Days</option>
          <option>Last 30 Days</option>
          <option>Last 3 Months</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Total Study Time</p>
          <p className="text-3xl font-bold text-gray-900">18.5 hrs</p>
          <p className="text-sm text-green-600 mt-2">↑ 12% from last week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Avg Session Length</p>
          <p className="text-3xl font-bold text-gray-900">42 min</p>
          <p className="text-sm text-green-600 mt-2">↑ 5 min longer</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Consistency Score</p>
          <p className="text-3xl font-bold text-gray-900">87%</p>
          <p className="text-sm text-yellow-600 mt-2">→ Same as last week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Best Time</p>
          <p className="text-3xl font-bold text-gray-900">7-9 PM</p>
          <p className="text-sm text-gray-500 mt-2">Most productive</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Time Trend</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[3, 4.5, 2, 5, 3.5, 4, 2.5].map((hours, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-indigo-500 rounded-t-lg"
                  style={{ height: `${(hours / 5) * 100}%` }}
                ></div>
                <p className="text-xs text-gray-500 mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Productivity Heatmap</h3>
          <div className="space-y-2">
            {['Morning', 'Afternoon', 'Evening', 'Night'].map((time, i) => (
              <div key={time} className="flex items-center space-x-2">
                <p className="text-sm text-gray-600 w-20">{time}</p>
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {Array(7).fill(0).map((_, j) => (
                    <div 
                      key={j}
                      className={`h-8 rounded ${
                        (i === 2 && j > 3) || (i === 1 && j < 3) ? 'bg-green-500' :
                        (i === 0 || i === 3) ? 'bg-gray-100' :
                        'bg-green-200'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">Darker = More productive</p>
        </div>
      </div>
    </div>
  );

  // Parent Goals & Rewards
  const ParentGoals = () => (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Goals & Rewards - Sarah Chen</h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Active Goals</h3>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>New Goal</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Study 600 minutes this week</h4>
                  <p className="text-sm text-gray-500">Set on Nov 18, 2025</p>
                </div>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">Active</span>
              </div>
              <div className="bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-green-500 rounded-full h-3" style={{ width: '65%' }}></div>
              </div>
              <p className="text-sm text-gray-600">390/600 minutes completed</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Maintain 7-day streak</h4>
                  <p className="text-sm text-gray-500">Set on Nov 15, 2025</p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">In Progress</span>
              </div>
              <div className="bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-yellow-500 rounded-full h-3" style={{ width: '100%' }}></div>
              </div>
              <p className="text-sm text-gray-600">7/7 days - Goal achieved!</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Reward System</h3>
            <button className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>New Reward</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-yellow-400 rounded-lg p-4 bg-yellow-50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">1 Hour Gaming Time</h4>
                  <p className="text-sm text-gray-500">Cost: 100 points</p>
                </div>
                <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">Pending</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">Requested on Nov 22, 2025</p>
              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                  Approve
                </button>
                <button className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                  Reject
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">Movie Night</h4>
                  <p className="text-sm text-gray-500">Cost: 200 points</p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded">Available</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">Shopping Trip</h4>
                  <p className="text-sm text-gray-500">Cost: 500 points</p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Redemption History</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">1 Hour Gaming Time</p>
              <p className="text-sm text-gray-500">Redeemed on Nov 15, 2025</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">-100 points</p>
              <p className="text-sm text-green-600">Approved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Parent Verify Sessions (NEW)
  const ParentVerify = () => {
    const pendingSessions = [
      { child: 'Sarah Chen', subject: 'Mathematics', duration: 45, date: 'Nov 22, 2025', time: '3:00 PM - 3:45 PM', points: 45, notes: 'Studied calculus derivatives', photo: true },
      { child: 'Sarah Chen', subject: 'Physics', duration: 60, date: 'Nov 22, 2025', time: '7:00 PM - 8:00 PM', points: 60, notes: 'Worked on mechanics problems', photo: false },
      { child: 'David Chen', subject: 'English', duration: 30, date: 'Nov 22, 2025', time: '4:00 PM - 4:30 PM', points: 30, notes: 'Essay writing practice', photo: true }
    ];

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Verify Study Sessions</h2>
            <p className="text-gray-500 mt-1">Review and approve your children's study sessions</p>
          </div>
          <span className="bg-red-100 text-red-800 text-sm font-semibold px-4 py-2 rounded-full">
            {pendingSessions.length} Pending
          </span>
        </div>

        <div className="space-y-4">
          {pendingSessions.map((session, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border-2 border-yellow-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{session.child}</h3>
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full">
                      {session.subject}
                    </span>
                  </div>
                  <p className="text-gray-600">{session.date} • {session.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{session.duration} min</p>
                  <p className="text-sm text-green-600">+{session.points} points</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Session Notes:</p>
                <p className="text-gray-600">{session.notes}</p>
              </div>

              {session.photo && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Study Material Photo:</p>
                  <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center">
                    <Eye className="w-8 h-8 text-gray-400" />
                    <span className="ml-2 text-gray-500">View Photo</span>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Approve Session</span>
                </button>
                <button className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center space-x-2">
                  <XCircle className="w-5 h-5" />
                  <span>Reject Session</span>
                </button>
                <button className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                  Request Info
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Verified</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div>
                <p className="font-medium text-gray-900">Sarah Chen - Chemistry (60 min)</p>
                <p className="text-sm text-gray-500">Verified on Nov 21, 2025</p>
              </div>
              <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded">Approved</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Teacher Dashboard
  const TeacherDashboard = () => (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Class Overview</h2>
        <p className="text-gray-500 mt-1">Monitor your students' learning progress</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Total Students</p>
          <p className="text-4xl font-bold text-gray-900">28</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Active This Week</p>
          <p className="text-4xl font-bold text-green-600">24</p>
          <p className="text-sm text-gray-500 mt-2">86% participation</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Avg Study Time</p>
          <p className="text-4xl font-bold text-indigo-600">4.2 hrs</p>
          <p className="text-sm text-gray-500 mt-2">per student/week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Pending Verifications</p>
          <p className="text-4xl font-bold text-yellow-600">12</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-3">
            {[
              { name: 'Sarah Chen', time: '8.5 hrs', points: 2850 },
              { name: 'Alex Kumar', time: '7.2 hrs', points: 2600 },
              { name: 'Emma Watson', time: '6.8 hrs', points: 2400 }
            ].map((student, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">{student.time} this week</p>
                  </div>
                </div>
                <p className="font-semibold text-indigo-600">{student.points} pts</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Attention</h3>
          <div className="space-y-3">
            {[
              { name: 'John Doe', time: '0.5 hrs', reason: 'Low activity' },
              { name: 'Lisa Park', time: '1.2 hrs', reason: 'Missed 3 days' },
              { name: 'Mike Johnson', time: '1.8 hrs', reason: 'Below average' }
            ].map((student, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-red-600">{student.reason}</p>
                </div>
                <button className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">
                  Contact
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Active Class Challenges</h3>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Challenge</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Study Marathon', participants: 24, goal: '500 mins', ends: '2 days' },
            { title: 'Math Focus Week', participants: 18, goal: '200 mins Math', ends: '5 days' },
            { title: 'Perfect Attendance', participants: 28, goal: '7 day streak', ends: '1 day' }
          ].map((challenge, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{challenge.title}</h4>
              <p className="text-sm text-gray-500 mb-1">{challenge.participants} participants</p>
              <p className="text-sm text-gray-500 mb-3">Goal: {challenge.goal}</p>
              <p className="text-xs text-indigo-600 font-medium">Ends in {challenge.ends}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Teacher Students (NEW)
  const TeacherStudents = () => {
    const students = [
      { name: 'Sarah Chen', level: 12, weeklyTime: 510, streak: 7, lastActive: '2 hours ago', status: 'excellent' },
      { name: 'Alex Kumar', level: 11, weeklyTime: 432, streak: 15, lastActive: '1 hour ago', status: 'excellent' },
      { name: 'Emma Watson', level: 10, weeklyTime: 408, streak: 12, lastActive: '3 hours ago', status: 'good' },
      { name: 'John Doe', level: 7, weeklyTime: 30, streak: 0, lastActive: '3 days ago', status: 'warning' },
      { name: 'Lisa Park', level: 9, weeklyTime: 72, streak: 2, lastActive: '1 day ago', status: 'warning' },
      { name: 'Mike Johnson', level: 8, weeklyTime: 108, streak: 3, lastActive: '5 hours ago', status: 'good' }
    ];

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">My Students</h2>
            <p className="text-gray-500 mt-1">Manage and monitor individual student progress</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Student</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Level</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Weekly Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Streak</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Last Active</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{student.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full">
                      {student.level}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{student.weeklyTime} min</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold text-gray-900">{student.streak}</span>
                      <span>🔥</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-500">{student.lastActive}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      student.status === 'excellent' ? 'bg-green-100 text-green-800' :
                      student.status === 'good' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Teacher Class Challenges (NEW)
  const TeacherChallenges = () => {
    const classChallenges = [
      { id: 1, title: 'Study Marathon', type: 'Time-Based', goal: '500 minutes total', participants: 24, progress: 68, startDate: 'Nov 20', endDate: 'Nov 25', reward: '50 bonus points', status: 'active' },
      { id: 2, title: 'Math Focus Week', type: 'Subject-Based', goal: '200 minutes in Math', participants: 18, progress: 45, startDate: 'Nov 18', endDate: 'Nov 24', reward: '100 bonus points', status: 'active' },
      { id: 3, title: 'Perfect Attendance', type: 'Streak-Based', goal: '7 day streak', participants: 28, progress: 85, startDate: 'Nov 15', endDate: 'Nov 23', reward: '75 bonus points', status: 'ending-soon' },
      { id: 4, title: 'Team Study Challenge', type: 'Collaborative', goal: '2000 minutes combined', participants: 28, progress: 55, startDate: 'Nov 1', endDate: 'Nov 30', reward: '150 bonus points', status: 'active' }
    ];

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Class Challenges</h2>
            <p className="text-gray-500 mt-1">Create and manage challenges for your students</p>
          </div>
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Create New Challenge</span>
          </button>
        </div>

        <div className="flex space-x-4 mb-6">
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">All Challenges</button>
          <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Active</button>
          <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Completed</button>
          <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Drafts</button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {classChallenges.map((challenge) => (
            <div key={challenge.id} className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-indigo-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{challenge.title}</h3>
                    {challenge.status === 'ending-soon' && (
                      <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                        Ending Soon
                      </span>
                    )}
                  </div>
                  <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
                    {challenge.type}
                  </span>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              <p className="text-gray-600 mb-4">{challenge.goal}</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Participants</p>
                  <p className="text-xl font-bold text-gray-900">{challenge.participants}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Reward</p>
                  <p className="text-sm font-semibold text-green-600">{challenge.reward}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Overall Progress</span>
                  <span className="font-semibold text-gray-900">{challenge.progress}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full h-3"
                    style={{ width: `${challenge.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span>{challenge.startDate} - {challenge.endDate}</span>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  View Details
                </button>
                <button className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                  Edit Challenge
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Teacher Class Analytics (NEW)
  const TeacherAnalytics = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Class Analytics</h2>
          <p className="text-gray-500 mt-1">Comprehensive insights into class performance</p>
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg">
          <option>Last 7 Days</option>
          <option>Last 30 Days</option>
          <option>This Semester</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Total Study Hours</p>
          <p className="text-4xl font-bold text-gray-900">342</p>
          <p className="text-sm text-green-600 mt-2">↑ 18% from last week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Class Average</p>
          <p className="text-4xl font-bold text-indigo-600">4.2 hrs</p>
          <p className="text-sm text-gray-500 mt-2">per student/week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Participation Rate</p>
          <p className="text-4xl font-bold text-green-600">86%</p>
          <p className="text-sm text-green-600 mt-2">↑ 4% from last week</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">Avg Streak</p>
          <p className="text-4xl font-bold text-orange-600">5.3</p>
          <p className="text-sm text-gray-500 mt-2">days</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Study Time Distribution</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[280, 320, 250, 380, 340, 360, 290].map((hours, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-indigo-500 rounded-t-lg"
                  style={{ height: `${(hours / 380) * 100}%` }}
                ></div>
                <p className="text-xs text-gray-500 mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Preferences</h3>
          <div className="space-y-4">
            {[
              { subject: 'Mathematics', percentage: 35, color: 'bg-blue-500' },
              { subject: 'Physics', percentage: 28, color: 'bg-purple-500' },
              { subject: 'Chemistry', percentage: 20, color: 'bg-green-500' },
              { subject: 'Biology', percentage: 17, color: 'bg-yellow-500' }
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-700 font-medium">{item.subject}</span>
                  <span className="text-gray-900 font-semibold">{item.percentage}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-3">
                  <div 
                    className={`${item.color} rounded-full h-3`}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Categories</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">Excellent (6+ hrs/week)</span>
              <span className="font-bold text-green-600">8 students</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">Good (4-6 hrs/week)</span>
              <span className="font-bold text-blue-600">12 students</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-gray-700">Average (2-4 hrs/week)</span>
              <span className="font-bold text-yellow-600">5 students</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-gray-700">Needs Support (under 2 hrs)</span>
              <span className="font-bold text-red-600">3 students</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Study Times</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">7-9 PM</span>
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '80px' }}></div>
                <span className="font-semibold text-gray-900">45%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">3-5 PM</span>
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '65px' }}></div>
                <span className="font-semibold text-gray-900">30%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">9-11 PM</span>
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '40px' }}></div>
                <span className="font-semibold text-gray-900">15%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Other</span>
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '25px' }}></div>
                <span className="font-semibold text-gray-900">10%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Achievements Unlocked</h3>
          <div className="text-center py-6">
            <p className="text-5xl font-bold text-indigo-600 mb-2">156</p>
            <p className="text-gray-600 mb-4">Total achievements this week</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">7-Day Streak</span>
              <span className="font-semibold">18 students</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">First Session</span>
              <span className="font-semibold">5 students</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Night Owl</span>
              <span className="font-semibold">12 students</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // View Router
  const renderView = () => {
    switch(currentView) {
      case 'student-dashboard': return <StudentDashboard />;
      case 'student-study': return <StudentStudySession />;
      case 'student-achievements': return <StudentAchievements />;
      case 'student-leaderboard': return <StudentLeaderboard />;
      case 'student-challenges': return <StudentChallenges />;
      case 'student-social': return <StudentSocial />;
      case 'parent-dashboard': return <ParentDashboard />;
      case 'parent-children': return <ParentChildren />;
      case 'parent-analytics': return <ParentAnalytics />;
      case 'parent-goals': return <ParentGoals />;
      case 'parent-verify': return <ParentVerify />;
      case 'teacher-dashboard': return <TeacherDashboard />;
      case 'teacher-students': return <TeacherStudents />;
      case 'teacher-challenges': return <TeacherChallenges />;
      case 'teacher-analytics': return <TeacherAnalytics />;
      default: return <StudentDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Role Selector (For Demo) */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setUserRole('student');
                setCurrentView('student-dashboard');
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                userRole === 'student' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Student View
            </button>
            <button
              onClick={() => {
                setUserRole('parent');
                setCurrentView('parent-dashboard');
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                userRole === 'parent' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Parent View
            </button>
            <button
              onClick={() => {
                setUserRole('teacher');
                setCurrentView('teacher-dashboard');
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                userRole === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Teacher View
            </button>
          </div>
          <div className="text-sm text-gray-500">
            StudyQuest UI Mockups - Complete Interactive Demo
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex">
        <Navigation role={userRole} />
        <div className="flex-1 overflow-auto">
          {renderView()}
        </div>
      </div>
    </div>
  );
}

export default StudyQuestMockups;