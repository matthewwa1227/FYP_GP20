// controllers/revisionController.js
// Document-based revision and quiz generation

const { query } = require('../db/connection');
const kimiService = require('../services/kimiService');
const contentService = require('../services/contentService');
const path = require('path');
const fs = require('fs').promises;

// ============================================
// UPLOAD DOCUMENT FOR REVISION
// ============================================
const uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    const file = req.file;
    console.log(`📄 Document uploaded: ${file.originalname} (${file.size} bytes)`);

    // Process the document
    const processedDoc = await contentService.processDocument(file.path, file.mimetype);
    
    if (!processedDoc.success) {
      // Clean up file
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: processedDoc.error || 'Failed to process document'
      });
    }

    // Save to database
    const docResult = await query(`
      INSERT INTO revision_documents (user_id, filename, original_name, mime_type, content, word_count, char_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      userId,
      file.filename,
      file.originalname,
      file.mimetype,
      processedDoc.content,
      processedDoc.wordCount,
      processedDoc.charCount
    ]);

    const documentId = docResult.rows[0].id;

    res.json({
      success: true,
      documentId: documentId,
      title: processedDoc.title,
      wordCount: processedDoc.wordCount,
      message: 'Document uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document'
    });
  }
};

// ============================================
// GENERATE REVISION QUIZ FROM DOCUMENT
// ============================================
const generateRevisionQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId, numQuestions = 5 } = req.body;

    // Get document content
    const docResult = await query(`
      SELECT content, original_name, word_count
      FROM revision_documents
      WHERE id = $1 AND user_id = $2
    `, [documentId, userId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const doc = docResult.rows[0];
    
    if (doc.word_count < 50) {
      return res.status(400).json({
        success: false,
        message: 'Document too short. Please upload a document with at least 50 words.'
      });
    }

    console.log(`📝 Generating revision quiz for: ${doc.original_name}`);

    // Generate quiz using Kimi
    const prompt = contentService.generateRevisionPrompt(doc.content, numQuestions);
    
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }],
      { maxTokens: 2000, useThinking: true }
    );

    const quizData = JSON.parse(response);

    // Save quiz to database
    const quizResult = await query(`
      INSERT INTO revision_quizzes (user_id, document_id, title, summary, key_concepts, questions)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      userId,
      documentId,
      quizData.title,
      quizData.summary,
      JSON.stringify(quizData.keyConcepts),
      JSON.stringify(quizData.questions)
    ]);

    res.json({
      success: true,
      quizId: quizResult.rows[0].id,
      ...quizData
    });

  } catch (error) {
    console.error('Generate revision quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz. Please try again.'
    });
  }
};

// ============================================
// GET USER'S DOCUMENTS
// ============================================
const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT id, original_name, word_count, char_count, created_at,
             (SELECT COUNT(*) FROM revision_quizzes WHERE document_id = rd.id) as quiz_count
      FROM revision_documents rd
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      documents: result.rows
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents'
    });
  }
};

// ============================================
// GET QUIZ BY ID
// ============================================
const getQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;

    const result = await query(`
      SELECT rq.*, rd.original_name as document_name
      FROM revision_quizzes rq
      JOIN revision_documents rd ON rq.document_id = rd.id
      WHERE rq.id = $1 AND rq.user_id = $2
    `, [quizId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const quiz = result.rows[0];
    quiz.questions = JSON.parse(quiz.questions);
    quiz.key_concepts = JSON.parse(quiz.key_concepts);

    res.json({
      success: true,
      quiz
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz'
    });
  }
};

// ============================================
// CHAT WITH DOCUMENT
// ============================================
const chatWithDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId, message } = req.body;

    // Get document content
    const docResult = await query(`
      SELECT content, original_name
      FROM revision_documents
      WHERE id = $1 AND user_id = $2
    `, [documentId, userId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const doc = docResult.rows[0];

    // Create prompt with document context
    const prompt = contentService.createDocumentChatPrompt(doc.content, message);

    // Get AI response
    const response = await kimiService.sendMessageToKimi(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1000, useThinking: true }
    );

    res.json({
      success: true,
      response,
      documentName: doc.original_name
    });

  } catch (error) {
    console.error('Chat with document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get response'
    });
  }
};

// ============================================
// FETCH URL CONTENT
// ============================================
const fetchUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL'
      });
    }

    console.log(`🌐 Fetching URL: ${url}`);

    const result = await contentService.fetchUrlContent(url);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch URL'
      });
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Fetch URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch URL'
    });
  }
};

module.exports = {
  uploadDocument,
  generateRevisionQuiz,
  getUserDocuments,
  getQuiz,
  chatWithDocument,
  fetchUrl
};
