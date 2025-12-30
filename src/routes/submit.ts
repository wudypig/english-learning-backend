import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { generateJSON } from '../services/gemini';
import { checkAndDecrementLimit } from '../utils/limit';

const router = Router();

// Submit Essay (Grades it)
router.post('/essay', authenticateToken, async (req: AuthRequest, res) => {
    const { article, essay } = req.body;
    const userId = req.user!.userId;

    const allowed = await checkAndDecrementLimit(userId, 'essay');
    if (!allowed) {
        return res.status(403).json({ error: "No essay attempts remaining" });
    }

    try {
        const prompt = `Grade this essay based on the following article.
        Article: "${article}"
        Essay: "${essay}"
        
        Provide:
        1. A score from 1.0 to 10.0 (float).
        2. Constructive feedback.
        3. Hints for improvement.
        
        Output JSON: { "score": number, "feedback": string }
        `;

        const grading = await generateJSON(prompt);

        // Save result
        const record = await prisma.testRecord.create({
            data: {
                userId,
                type: 'essay',
                content: article,
                answers: essay,
                score: grading.score,
                feedback: grading.feedback
            }
        });

        res.json({ record });
    } catch (e) {
        res.status(500).json({ error: "Failed to grade essay" });
    }
});

// Submit Reading Result
router.post('/reading', authenticateToken, async (req: AuthRequest, res) => {
    const { article, questions, answers, score } = req.body;
    const userId = req.user!.userId;

    const allowed = await checkAndDecrementLimit(userId, 'reading');
    if (!allowed) {
        return res.status(403).json({ error: "No reading attempts remaining" });
    }

    try {
        // Save result
        const record = await prisma.testRecord.create({
            data: {
                userId,
                type: 'reading',
                content: article,
                questions: JSON.stringify(questions),
                answers: JSON.stringify(answers),
                score: score,
            }
        });

        res.json({ record });
    } catch (e) {
        res.status(500).json({ error: "Failed to submit reading test" });
    }
});

export default router;
