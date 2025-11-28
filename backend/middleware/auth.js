const jwt = require('jsonwebtoken');

// Middleware to verify JWT token and protect routes
const authenticateToken = (req, res, next) => {
  try {
    // Get token from header
    // Expected format: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token after "Bearer "

    // If no token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // Token is invalid or expired
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }

      // Token is valid - attach user info to request
      req.student = {
        id: decoded.studentId,
        email: decoded.email,
        username: decoded.username
      };

      // Continue to next middleware/route handler
      next();
    });

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Optional middleware - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token, but that's okay - continue without user info
      req.student = null;
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // Invalid token, but that's okay - continue without user info
        req.student = null;
      } else {
        // Valid token - attach user info
        req.student = {
          id: decoded.studentId,
          email: decoded.email,
          username: decoded.username
        };
      }
      next();
    });

  } catch (error) {
    req.student = null;
    next();
  }
};

module.exports = { authenticateToken, optionalAuth };