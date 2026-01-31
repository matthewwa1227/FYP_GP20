const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const tutorSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    enum: ['learn', 'quiz', 'hint', 'explain'],
    required: true
  },
  messages: [messageSchema],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  xpEarned: {
    type: Number,
    default: 0
  },
  stats: {
    messageCount: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    hintsGiven: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
tutorSessionSchema.index({ user: 1, startTime: -1 });
tutorSessionSchema.index({ user: 1, subject: 1 });

module.exports = mongoose.model('TutorSession', tutorSessionSchema);