import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import { prisma } from './utils/prisma';
import contentRoutes from './routes/content';
import submitRoutes from './routes/submit';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import { requestLogger } from './middleware/logger';
import { generalLimiter, contentLimiter } from './middleware/rateLimit';

dotenv.config();

if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
    console.error('FATAL: JWT_SECRET and REFRESH_TOKEN_SECRET must be set');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3010; // Changed port to 3010 to avoid conflict with Vite (3000 often used) or I can set Vite to 5173 (default)

// Trust proxy - required when behind Cloud Run or other reverse proxies
// Cloud Run uses 1 proxy hop, so we trust the first proxy
// This prevents IP spoofing while allowing rate limiting to work correctly
app.set('trust proxy', 1);

app.use(cors({
    origin: [
        'http://localhost:5173',           // Client dev
        'http://localhost:5174',           // Admin dev
        'https://writenest.net',           // Custom domain
        'https://www.writenest.net',       // WWW subdomain
        'https://admin.writenest.net',     // Admin custom domain
        'https://english-learning-frontend.web.app',        // Firebase default
        'https://english-learning-frontend.firebaseapp.com', // Firebase secondary
        'https://writenest-admin.web.app',            // Admin Firebase default
        'https://writenest-admin.firebaseapp.com'     // Admin Firebase secondary
    ],
    credentials: true
}));
app.use(express.json());
app.use(requestLogger); // Log all API requests
app.use(generalLimiter); // Apply general rate limiting to all routes

// Routes with specific rate limiters
// authLimiter is applied per-route inside auth.ts (login/register only)
app.use('/auth', authRoutes);
app.use('/content', contentLimiter, contentRoutes);
app.use('/submit', submitRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
    res.send('English Learning Service API');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Hourly cleanup of expired refresh tokens
setInterval(async () => {
    await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}, 60 * 60 * 1000);
