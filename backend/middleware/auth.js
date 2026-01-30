const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }

      // Set BOTH req.user and req.student for compatibility
      req.user = {
        id: decoded.studentId || decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role || 'student'
      };
      
      // Backwards compatibility
      req.student = req.user;

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

const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      req.student = null;
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        req.user = null;
        req.student = null;
      } else {
        req.user = {
          id: decoded.studentId || decoded.id,
          email: decoded.email,
          username: decoded.username,
          role: decoded.role || 'student'
        };
        req.student = req.user;
      }
      next();
    });

  } catch (error) {
    req.user = null;
    req.student = null;
    next();
  }
};

module.exports = { authenticateToken, optionalAuth };