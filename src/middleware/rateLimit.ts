import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication endpoints
// Prevents brute force attacks on login/register
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip the trust proxy validation since we've properly configured it in index.ts
    validate: { trustProxy: false },
    handler: (req, res) => {
        console.log(`[Rate Limit] Auth limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many authentication attempts, please try again after 15 minutes'
        });
    }
});

// Moderate rate limiter for content generation endpoints
// Prevents excessive use of AI API (costs money)
export const contentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 content generation requests per hour
    message: {
        error: 'Too many content generation requests, please try again after an hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip the trust proxy validation since we've properly configured it in index.ts
    validate: { trustProxy: false },
    handler: (req, res) => {
        console.log(`[Rate Limit] Content generation limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many content generation requests, please try again after an hour'
        });
    }
});

// General rate limiter for all other endpoints
// Prevents DoS attacks
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per 15 minutes
    message: {
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip the trust proxy validation since we've properly configured it in index.ts
    validate: { trustProxy: false },
    handler: (req, res) => {
        console.log(`[Rate Limit] General limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests, please try again later'
        });
    }
});
