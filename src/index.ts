import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import submitRoutes from './routes/submit';
import userRoutes from './routes/user';
import { requestLogger } from './middleware/logger';
import { generalLimiter, authLimiter, contentLimiter } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010; // Changed port to 3010 to avoid conflict with Vite (3000 often used) or I can set Vite to 5173 (default)

app.use(cors());
app.use(express.json());
app.use(requestLogger); // Log all API requests
app.use(generalLimiter); // Apply general rate limiting to all routes

// Routes with specific rate limiters
app.use('/auth', authLimiter, authRoutes);
app.use('/content', contentLimiter, contentRoutes);
app.use('/submit', submitRoutes);
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.send('English Learning Service API');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
