import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import submitRoutes from './routes/submit';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import { requestLogger } from './middleware/logger';
import { generalLimiter, authLimiter, contentLimiter } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010; // Changed port to 3010 to avoid conflict with Vite (3000 often used) or I can set Vite to 5173 (default)

// Trust proxy - required when behind Cloud Run or other reverse proxies
app.set('trust proxy', true);

app.use(cors({
    origin: [
        'http://localhost:5173',           // Local dev
        'https://writenest.net',           // Custom domain
        'https://www.writenest.net',       // WWW subdomain
        'https://english-learning-frontend.web.app',        // Firebase default
        'https://english-learning-frontend.firebaseapp.com' // Firebase secondary
    ],
    credentials: true
}));
app.use(express.json());
app.use(requestLogger); // Log all API requests
app.use(generalLimiter); // Apply general rate limiting to all routes

// Routes with specific rate limiters
app.use('/auth', authLimiter, authRoutes);
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
