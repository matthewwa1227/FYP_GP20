// services/contentService.js
// URL fetching and document processing

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// URL FETCHING
// ============================================
const fetchUrlContent = async (url) => {
  try {
    console.log(`🌐 Fetching URL: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxContentLength: 5 * 1024 * 1024 // 5MB max
    });

    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .advertisement, .ads, .sidebar').remove();
    
    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
    
    // Extract main content
    let content = '';
    
    // Try to find main content area
    const mainSelectors = ['main', 'article', '.content', '.main-content', '#content', '.post-content', '.entry-content'];
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }
    
    // Fallback to body if no main content found
    if (!content) {
      content = $('body').text().trim();
    }
    
    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').substring(0, 10000); // Limit to 10k chars
    
    console.log(`✅ URL fetched: ${title.substring(0, 50)}...`);
    
    return {
      success: true,
      title: title.substring(0, 200),
      content: content,
      url: url,
      wordCount: content.split(' ').length
    };
    
  } catch (error) {
    console.error('❌ URL fetch error:', error.message);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
};

// ============================================
// DOCUMENT PROCESSING
// ============================================
const processDocument = async (filePath, mimeType) => {
  try {
    console.log(`📄 Processing document: ${filePath}`);
    
    let content = '';
    let title = path.basename(filePath, path.extname(filePath));
    
    if (mimeType === 'text/plain' || filePath.endsWith('.txt')) {
      // Text files
      content = await fs.readFile(filePath, 'utf-8');
      
    } else if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
      // For PDF, we'll extract text using a simple approach
      // In production, you'd use pdf-parse library
      content = await extractPdfText(filePath);
      
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               filePath.endsWith('.docx')) {
      // For DOCX, extract text
      content = await extractDocxText(filePath);
      
    } else if (mimeType === 'text/markdown' || filePath.endsWith('.md')) {
      content = await fs.readFile(filePath, 'utf-8');
      
    } else {
      throw new Error('Unsupported file type');
    }
    
    // Clean and limit content
    content = content.replace(/\s+/g, ' ').substring(0, 50000); // 50k chars max
    
    // Try to extract title from first line
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0 && lines[0].length < 100) {
      title = lines[0].trim();
    }
    
    console.log(`✅ Document processed: ${title.substring(0, 50)}... (${content.length} chars)`);
    
    return {
      success: true,
      title: title,
      content: content,
      wordCount: content.split(' ').length,
      charCount: content.length
    };
    
  } catch (error) {
    console.error('❌ Document processing error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Simple PDF text extraction (placeholder - would use pdf-parse in production)
const extractPdfText = async (filePath) => {
  // In production, use: const pdfParse = require('pdf-parse');
  // For now, return a message
  return `[PDF Document Content Placeholder - In production, install pdf-parse library]
  
Document: ${path.basename(filePath)}

To enable PDF processing:
1. npm install pdf-parse
2. Update this function to use pdf-parse library

The content would be extracted here for AI processing.`;
};

// Simple DOCX text extraction (placeholder)
const extractDocxText = async (filePath) => {
  // In production, use: const mammoth = require('mammoth');
  return `[DOCX Document Content Placeholder - In production, install mammoth library]
  
Document: ${path.basename(filePath)}

To enable DOCX processing:
1. npm install mammoth
2. Update this function to use mammoth library

The content would be extracted here for AI processing.`;
};

// ============================================
// GENERATE REVISION QUESTIONS FROM CONTENT
// ============================================
const generateRevisionPrompt = (content, numQuestions = 5) => {
  return `You are a helpful tutor creating a revision session based on the following document.

DOCUMENT CONTENT:
${content.substring(0, 8000)}

Please create ${numQuestions} multiple choice questions based on the KEY CONCEPTS in this document.

Return ONLY valid JSON in this format:
{
  "title": "Document Title",
  "summary": "Brief 2-3 sentence summary of the document",
  "keyConcepts": ["concept1", "concept2", "concept3"],
  "questions": [
    {
      "question": "Question text?",
      "choices": [
        {"text": "Correct answer", "correct": true},
        {"text": "Wrong answer 1", "correct": false},
        {"text": "Wrong answer 2", "correct": false},
        {"text": "Wrong answer 3", "correct": false}
      ],
      "explanation": "Why the correct answer is right"
    }
  ]
}

Make questions test understanding, not just memorization.`;
};

// ============================================
// CHAT WITH DOCUMENT CONTEXT
// ============================================
const createDocumentChatPrompt = (content, userQuestion) => {
  return `You are helping a student understand a document they uploaded.

DOCUMENT CONTEXT (first 5000 characters):
${content.substring(0, 5000)}

STUDENT QUESTION: ${userQuestion}

Answer based ONLY on the document content provided. If the answer isn't in the document, say so and offer to help with related concepts.

Keep your response concise (2-4 sentences) and encouraging.`;
};

module.exports = {
  fetchUrlContent,
  processDocument,
  generateRevisionPrompt,
  createDocumentChatPrompt
};
