const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
// Uncomment when you create these files:
// app.use('/api/sessions', require('./routes/sessions'));
// app.use('/api/students', require('./routes/students'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running!', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📍 Available endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/api/health`);
  console.log(`   - GET  http://localhost:${PORT}/api/auth/health`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/logout`);
});