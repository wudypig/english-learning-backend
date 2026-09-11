import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { generateJSON } from '../services/gemini';
import { checkAndDecrementLimit } from '../utils/limit';

const router = Router();

const ESSAY_DIMENSIONS = ['grammar', 'vocabulary', 'coherence', 'relevance', 'argumentation', 'mechanics'] as const;
type EssayDimension = typeof ESSAY_DIMENSIONS[number];

const toStringArray = (v: unknown): string[] => Array.isArray(v) ? v : [];

// Submit Essay (Grades it)
router.post('/essay', authenticateToken, async (req: AuthRequest, res) => {
    const { essay } = req.body;
    const userId = req.user!.userId;

    const pending = await prisma.pendingContent.findUnique({
        where: { userId_type: { userId, type: 'essay' } }
    });

    if (!pending) {
        return res.status(400).json({ error: 'No pending essay found. Please generate content first.' });
    }

    const article = pending.content;

    if (typeof essay !== 'string') {
        return res.status(400).json({ error: 'essay is required' });
    }

    const allowed = await checkAndDecrementLimit(userId, 'essay');
    if (!allowed) {
        return res.status(403).json({ error: "No essay attempts remaining" });
    }

    try {
        const prompt = `Grade this essay based on the following article.
Article: "${article}"
Essay: "${essay}"

Score the essay on these 6 dimensions (each 1.0–10.0, one decimal place):
1. grammar       — sentence structure, tense consistency, subject-verb agreement
2. vocabulary    — word choice variety, appropriateness, avoiding repetition
3. coherence     — logical flow, transitions between paragraphs, overall structure
4. relevance     — how well the essay addresses the article/prompt
5. argumentation — strength of points, use of examples and evidence
6. mechanics     — spelling, punctuation, capitalization

Also provide:
- feedback: one constructive paragraph summarising the essay
- 2–3 strengths (short phrases, e.g. "clear paragraph structure")
- 2–3 weaknesses (short phrases, e.g. "inconsistent verb tense")
- 2–3 improvement_tips (actionable sentences)

Output JSON exactly:
{
  "scores": {
    "grammar": number,
    "vocabulary": number,
    "coherence": number,
    "relevance": number,
    "argumentation": number,
    "mechanics": number
  },
  "feedback": string,
  "strengths": [string],
  "weaknesses": [string],
  "improvement_tips": [string]
}`;

        const grading = await generateJSON(prompt);

        const dimScores = ESSAY_DIMENSIONS.map((d: EssayDimension) => {
            const v = grading.scores?.[d];
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 10) {
                throw new Error(`Invalid score for dimension: ${d}`);
            }
            return v;
        });

        const overall = parseFloat(
            (dimScores.reduce((a, b) => a + b, 0) / ESSAY_DIMENSIONS.length).toFixed(2)
        );

        const metadata = {
            scores: grading.scores,
            strengths: toStringArray(grading.strengths),
            weaknesses: toStringArray(grading.weaknesses),
            improvement_tips: toStringArray(grading.improvement_tips),
        };

        const [, record] = await prisma.$transaction([
            prisma.pendingContent.delete({
                where: { userId_type: { userId, type: 'essay' } }
            }),
            prisma.testRecord.create({
                data: {
                    userId,
                    type: 'essay',
                    content: article,
                    answers: essay,
                    score: overall,
                    feedback: typeof grading.feedback === 'string' ? grading.feedback : null,
                    metadata: JSON.stringify(metadata),
                }
            })
        ]);

        res.json({ record });
    } catch (e) {
        console.error('[submit/essay]', e);
        res.status(500).json({ error: "Failed to grade essay" });
    }
});

// Submit Reading Result
router.post('/reading', authenticateToken, async (req: AuthRequest, res) => {
    const { answers, score } = req.body;
    const userId = req.user!.userId;

    const pending = await prisma.pendingContent.findUnique({
        where: { userId_type: { userId, type: 'reading' } }
    });

    if (!pending) {
        return res.status(400).json({ error: 'No pending reading test found. Please generate content first.' });
    }

    const article = pending.content;
    const questions = pending.questions;

    const allowed = await checkAndDecrementLimit(userId, 'reading');
    if (!allowed) {
        return res.status(403).json({ error: "No reading attempts remaining" });
    }

    try {
        const [, record] = await prisma.$transaction([
            prisma.pendingContent.delete({
                where: { userId_type: { userId, type: 'reading' } }
            }),
            prisma.testRecord.create({
                data: {
                    userId,
                    type: 'reading',
                    content: article,
                    questions: questions,
                    answers: JSON.stringify(answers),
                    score: score,
                }
            })
        ]);

        res.json({ record });
    } catch (e) {
        res.status(500).json({ error: "Failed to submit reading test" });
    }
});

export default router;
