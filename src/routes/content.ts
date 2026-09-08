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

        const enhancedPrompt = `Write a ${topicSelection.style} article about "${topicSelection.topic}" (category: ${topicSelection.category}).

Narrative point of view: ${topicSelection.perspective}.
Specific angle: ${topicSelection.hook}.

Requirements:
- 200–300 words
- Open with a vivid scene, question, or striking fact — NOT a generic statement like "X is important in today's world"
- Use at least one concrete example, real place, or named character to ground the content
- Do not start with a definition or broad overview
- Appropriate for an English learner at ${level} grade level

Return only the article body. No title. No extra formatting.`;

        const article = await generateContent(
            enhancedPrompt,
            level,
            1.3
        );

        saveRecentTopic(userId, topicSelection.category, topicSelection.topic, topicSelection.style, topicSelection.perspective)
            .catch(err => console.error('Failed to save recent topic:', err));

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

        cleanupOldTopics().catch(err => console.error('Failed to cleanup old topics:', err));

        const topicSelection = await selectRandomTopic(userId);

        const prompt = `Generate a reading comprehension test on the topic: "${topicSelection.topic}" (category: ${topicSelection.category}).

Article requirements:
- Writing style: ${topicSelection.style}
- Narrative point of view: ${topicSelection.perspective}
- Specific angle: ${topicSelection.hook}
- 300–400 words
- Open with a concrete scene, anecdote, or striking fact — NOT a generic introduction
- Use specific names, places, or data points to make the content feel real
- Appropriate for a ${level} grade English learner

Question requirements:
- 5 multiple choice questions, 4 options each
- Mix of question types: detail recall, inference, vocabulary-in-context, main idea, author's purpose

Output as JSON only:
{ "article": string, "questions": [{ "id": number, "text": string, "options": string[], "correctOptionIndex": number }] }`;

        // Use default temperature (1.0) for JSON output — higher values risk malformed JSON
        const testContent = await generateJSON(prompt, level);

        saveRecentTopic(userId, topicSelection.category, topicSelection.topic, topicSelection.style, topicSelection.perspective)
            .catch(err => console.error('Failed to save recent topic:', err));

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
