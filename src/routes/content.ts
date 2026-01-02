import { Router } from 'express';
import { generateContent, generateJSON } from '../services/gemini';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

// Get Essay Topic
router.post('/essay/generate', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Check if user has remaining attempts
        const limit = await prisma.usageLimit.findUnique({
            where: {
                userId_testType: {
                    userId,
                    testType: 'essay'
                }
            }
        });

        // -1 means unlimited, 0 or less (except -1) means no attempts
        if (!limit || (limit.remainingAttempts <= 0 && limit.remainingAttempts !== -1)) {
            return res.status(403).json({
                error: 'No remaining attempts for essay writing. Please contact admin to increase your limit.'
            });
        }

        // Fetch user's difficulty level
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { difficultyLevel: true }
        });

        const level = user?.difficultyLevel || '7th';
        const article = await generateContent(
            "Write a short interesting article (about 200-300 words) suitable for English learners. Topics can be technology, culture, nature, etc. Just return the article text.",
            level
        );
        res.json({ article });
    } catch (e) {
        res.status(500).json({ error: "Failed to generate essay content" });
    }
});

// Get Reading Test
router.post('/reading/generate', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Check if user has remaining attempts
        const limit = await prisma.usageLimit.findUnique({
            where: {
                userId_testType: {
                    userId,
                    testType: 'reading'
                }
            }
        });

        // -1 means unlimited, 0 or less (except -1) means no attempts
        if (!limit || (limit.remainingAttempts <= 0 && limit.remainingAttempts !== -1)) {
            return res.status(403).json({
                error: 'No remaining attempts for reading test. Please contact admin to increase your limit.'
            });
        }

        // Fetch user's difficulty level
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { difficultyLevel: true }
        });

        const level = user?.difficultyLevel || '7th';
        const prompt = `Generate a reading comprehension test. 
        1. A comprehensive article (300-400 words).
        2. 5 multiple choice questions based on the article.
        3. Each question should have 4 options and 1 correct answer.
        
        Output format: JSON object with keys: "article" (string), "questions" (array of objects { "id": number, "text": string, "options": string[], "correctOptionIndex": number }).
        `;
        const testContent = await generateJSON(prompt, level);
        res.json(testContent);
    } catch (e) {
        res.status(500).json({ error: "Failed to generate reading test" });
    }
});

// Explain content
router.post('/explain', authenticateToken, async (req: AuthRequest, res) => {
    const { text, language = "Chinese" } = req.body;
    try {
        const explanation = await generateContent(`Explain the following text in ${language}. Provide a summary and key vocabulary explanations:\n\n${text}`);
        res.json({ explanation });
    } catch (e) {
        res.status(500).json({ error: "Failed to explain content" });
    }
});

export default router;
