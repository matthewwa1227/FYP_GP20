// concurrencyGuard.js
// MISSION 62: Rate limiting and concurrency protection middleware
// Prevents abuse and handles concurrent access from multiple devices

// ============================================
// IN-MEMORY STORE (suitable for Render single instance)
// For multi-instance, use Redis or database-backed store
// ============================================
class RateLimitStore {
  constructor() {
    this.requests = new Map(); // key -> { count, resetTime }
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests) {
      if (data.resetTime < now) {
        this.requests.delete(key);
      }
    }
  }

  get(key, windowMs) {
    const now = Date.now();
    const data = this.requests.get(key);
    
    if (!data || data.resetTime < now) {
      // Create new window
      const newData = { count: 1, resetTime: now + windowMs };
      this.requests.set(key, newData);
      return { count: 1, resetTime: newData.resetTime, isNew: true };
    }
    
    data.count++;
    return { count: data.count, resetTime: data.resetTime, isNew: false };
  }

  reset(key) {
    this.requests.delete(key);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

const store = new RateLimitStore();

// ============================================
// RATE LIMITING MIDDLEWARE FACTORY
// ============================================
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,      // 1 minute default
    maxRequests = 100,          // Max requests per window
    keyGenerator = (req) => req.ip, // Default: limit by IP
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    skip = (req) => false,      // Function to skip certain requests
    handler = null,             // Custom handler when limit exceeded
    onLimitReached = null,      // Callback when limit reached
  } = options;

  return async (req, res, next) => {
    // Skip if configured
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const result = store.get(key, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - result.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    // Check if limit exceeded
    if (result.count > maxRequests) {
      if (onLimitReached) {
        onLimitReached(req, res);
      }

      if (handler) {
        return handler(req, res, next);
      }

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    // Track response for skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      res.on('finish', () => {
        const status = res.statusCode;
        if (skipSuccessfulRequests && status < 400) {
          result.count--;
        }
        if (skipFailedRequests && status >= 400) {
          result.count--;
        }
      });
    }

    next();
  };
};

// ============================================
// PRECONFIGURED LIMITERS
// ============================================

// General API rate limit: 100 requests/minute per IP
const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req) => `ip:${req.ip}`,
  skip: (req) => req.path === '/api/health' || req.path === '/api/health/db',
});

// Strict user limit: 20 requests/minute per user (authenticated)
const userLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => {
    const userId = req.student?.id || req.user?.id || req.studentId;
    const ip = req.ip;
    return userId ? `user:${userId}` : `ip:${ip}`;
  },
  skip: (req) => req.path === '/api/health' || req.path === '/api/health/db',
});

// Study session limit: Prevent session spam
// Max 10 session starts/end per minute per user
const sessionActionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => {
    const userId = req.student?.id || req.user?.id;
    return `session:${userId || req.ip}`;
  },
});

// Achievement check limit: Prevent achievement spam
const achievementLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => {
    const userId = req.student?.id || req.user?.id;
    return `achievement:${userId || req.ip}`;
  },
});

// Login limit: Prevent brute force
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,           // 5 attempts
  keyGenerator: (req) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
  skip: (req) => req.method !== 'POST',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

// ============================================
// CONCURRENT REQUEST DEDUPLICATION
// ============================================
class DedupeStore {
  constructor() {
    this.inProgress = new Map(); // key -> Promise
  }

  async dedupe(key, fn) {
    // If already in progress, wait for it
    if (this.inProgress.has(key)) {
      console.log(`🔄 Deduplicating concurrent request: ${key}`);
      return this.inProgress.get(key);
    }

    // Start new operation
    const promise = fn().finally(() => {
      this.inProgress.delete(key);
    });

    this.inProgress.set(key, promise);
    return promise;
  }

  clear(key) {
    this.inProgress.delete(key);
  }
}

const dedupeStore = new DedupeStore();

// Middleware to dedupe identical requests from same user
const dedupeMiddleware = (keyGenerator) => {
  return async (req, res, next) => {
    const key = keyGenerator(req);
    if (!key) return next();

    // Set dedupe header
    res.setHeader('X-Dedupe-Key', key);

    try {
      await dedupeStore.dedupe(key, () => {
        return new Promise((resolve, reject) => {
          // Override res.json to capture result
          const originalJson = res.json.bind(res);
          res.json = (data) => {
            originalJson(data);
            resolve(data);
          };

          // Override res.status for error cases
          const originalStatus = res.status.bind(res);
          res.status = (code) => {
            if (code >= 400) {
              resolve({ error: true, status: code });
            }
            return originalStatus(code);
          };

          next();
        });
      });
    } catch (err) {
      next(err);
    }
  };
};

// ============================================
// DEVICE CONFLICT DETECTION
// ============================================
const deviceConflictMiddleware = (options = {}) => {
  const { 
    headerName = 'X-Device-ID',
    onConflict = null 
  } = options;

  return (req, res, next) => {
    const deviceId = req.headers[headerName.toLowerCase()] || req.headers[headerName];
    
    if (deviceId) {
      req.deviceId = deviceId;
      res.setHeader('X-Device-Recognized', 'true');
    }

    next();
  };
};

// ============================================
// CIRCUIT BREAKER (for external API calls)
// ============================================
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.warn(`🔴 Circuit breaker OPENED for ${this.timeout}ms`);
    }
  }
}

// ============================================
// HEALTH CHECK MIDDLEWARE
// ============================================
const healthCheck = async (req, res) => {
  const { getPoolMetrics } = require('../db/connection');
  
  try {
    const metrics = getPoolMetrics();
    
    // Determine health status
    let status = 'healthy';
    if (metrics.utilizationPercent > 90) {
      status = 'critical';
    } else if (metrics.utilizationPercent > 70) {
      status = 'warning';
    }

    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        pool: metrics,
      },
      rateLimits: {
        activeWindows: store.requests.size,
      },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: err.message,
    });
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Rate limiters
  generalLimiter,
  userLimiter,
  sessionActionLimiter,
  achievementLimiter,
  loginLimiter,
  createRateLimiter,
  
  // Concurrency protection
  dedupeMiddleware,
  dedupeStore,
  deviceConflictMiddleware,
  
  // Circuit breaker
  CircuitBreaker,
  
  // Health check
  healthCheck,
  
  // Store management
  resetRateLimit: (key) => store.reset(key),
  getRateLimitStore: () => store,
};
