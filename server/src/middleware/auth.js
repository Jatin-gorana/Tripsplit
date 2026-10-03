const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod';

/**
 * Authentication Middleware: Verifies Bearer JWT Token
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user info
    const userRes = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Rate limiter for Auth endpoints (signup / login)
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

module.exports = {
  authenticateToken,
  authRateLimiter,
  JWT_SECRET
};
