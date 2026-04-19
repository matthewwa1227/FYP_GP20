// routes/revision.js
// Document-based revision routes

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const revisionController = require('../controllers/revisionController');

// Ensure uploads directory exists (Render ephemeral filesystem)
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype) || 
      file.originalname.match(/\.(txt|md|pdf|docx)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only TXT, MD, PDF, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Apply authentication to all routes
router.use(authenticateToken);

// Upload document
router.post('/upload', upload.single('document'), revisionController.uploadDocument);

// Generate quiz from document
router.post('/quiz/generate', revisionController.generateRevisionQuiz);

// Get user's documents
router.get('/documents', revisionController.getUserDocuments);

// Get quiz by ID
router.get('/quiz/:quizId', revisionController.getQuiz);

// Chat with document
router.post('/chat', revisionController.chatWithDocument);

// Fetch URL content
router.post('/fetch-url', revisionController.fetchUrl);

module.exports = router;
