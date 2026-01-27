import { Router } from 'express';
import { generateContent, generateJSON } from '../services/gemini';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { selectRandomTopic, saveRecentTopic, cleanupOldTopics } from '../utils/topicGenerator';

const router = Router();

// Get Essay Topic
router.post('/essay/generate', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Fetch user with usage limits and difficulty level in one query
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                difficultyLevel: true,
                usageLimits: {
                    where: { testType: 'essay' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has remaining attempts
        const limit = user.usageLimits[0]; // Get essay limit from relation

        // -1 means unlimited, 0 or less (except -1) means no attempts
        if (!limit || (limit.remainingAttempts <= 0 && limit.remainingAttempts !== -1)) {
            return res.status(403).json({
                error: 'No remaining attempts for essay writing. Please contact admin to increase your limit.'
            });
        }

        const level = user.difficultyLevel || '7th';

        // Clean up old topics (async, non-blocking)
        cleanupOldTopics().catch(err => console.error('Failed to cleanup old topics:', err));

        // Select a random topic with variety constraints
        const topicSelection = await selectRandomTopic(userId);

        // Construct enhanced prompt with specific topic, style, and perspective
        const enhancedPrompt = `Write a ${topicSelection.style} article from ${topicSelection.perspective} about "${topicSelection.topic}" in the category of ${topicSelection.category}.

The article should be 200-300 words, engaging, and suitable for English learners.
Use creative examples, vivid descriptions, and unique angles to make the content fresh and interesting.
Avoid clichés and generic statements - make this article stand out with original insights and compelling storytelling.

Just return the article text without any title or extra formatting.`;

        // Generate content with increased temperature for more creativity (1.3)
        const article = await generateContent(
            enhancedPrompt,
            level,
            1.3  // Higher temperature = more creative and diverse outputs
        );

        // Save the topic to recent topics for future avoidance
        await saveRecentTopic(userId, topicSelection.category, topicSelection.topic);

        res.json({ article });
    } catch (e: any) {
        console.error('Essay generation error:', e);

        // Extract user-friendly error message
        const errorMessage = e?.message || "Failed to generate essay content";

        // Check if it's a rate limit error
        if (errorMessage.includes("API_RATE_LIMIT")) {
            return res.status(429).json({
                error: "Too many content generation requests. The API has rate limits. Please wait a few minutes and try again.",
                type: "RATE_LIMIT"
            });
        }

        // Check if it's an auth error
        if (errorMessage.includes("API_AUTH_ERROR")) {
            return res.status(500).json({
                error: "There is a configuration issue with the API. Please contact support.",
                type: "AUTH_ERROR"
            });
        }

        // Generic error
        res.status(500).json({
            error: errorMessage.replace(/^API_[A-Z_]+:\s*/, ''), // Remove error prefix for cleaner message
            type: "GENERATION_ERROR"
        });
    }
});

// Get Reading Test
router.post('/reading/generate', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Fetch user with usage limits and difficulty level in one query
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                difficultyLevel: true,
                usageLimits: {
                    where: { testType: 'reading' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has remaining attempts
        const limit = user.usageLimits[0]; // Get reading limit from relation

        // -1 means unlimited, 0 or less (except -1) means no attempts
        if (!limit || (limit.remainingAttempts <= 0 && limit.remainingAttempts !== -1)) {
            return res.status(403).json({
                error: 'No remaining attempts for reading test. Please contact admin to increase your limit.'
            });
        }

        const level = user.difficultyLevel || '7th';
        const prompt = `Generate a reading comprehension test. 
        1. A comprehensive article (300-400 words).
        2. 5 multiple choice questions based on the article.
        3. Each question should have 4 options and 1 correct answer.
        
        Output format: JSON object with keys: "article" (string), "questions" (array of objects { "id": number, "text": string, "options": string[], "correctOptionIndex": number }).
        `;
        const testContent = await generateJSON(prompt, level);
        res.json(testContent);
    } catch (e: any) {
        console.error('Reading test generation error:', e);

        // Extract user-friendly error message
        const errorMessage = e?.message || "Failed to generate reading test";

        // Check if it's a rate limit error
        if (errorMessage.includes("API_RATE_LIMIT")) {
            return res.status(429).json({
                error: "Too many content generation requests. The API has rate limits. Please wait a few minutes and try again.",
                type: "RATE_LIMIT"
            });
        }

        // Check if it's an auth error
        if (errorMessage.includes("API_AUTH_ERROR")) {
            return res.status(500).json({
                error: "There is a configuration issue with the API. Please contact support.",
                type: "AUTH_ERROR"
            });
        }

        // Generic error
        res.status(500).json({
            error: errorMessage.replace(/^API_[A-Z_]+:\s*/, ''), // Remove error prefix for cleaner message
            type: "GENERATION_ERROR"
        });
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
