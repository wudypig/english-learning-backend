import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { usageLimits: true }
    });

    // Also get history summary
    const history = await prisma.testRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    res.json({ user, history });
});

router.put('/settings', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { nickname, avatar, difficultyLevel } = req.body;

    // Validate difficultyLevel if provided
    const validLevels = ['7th', '8th', '9th', '10th', '11th', '12th'];
    if (difficultyLevel && !validLevels.includes(difficultyLevel)) {
        return res.status(400).json({ error: 'Invalid difficulty level. Must be one of: 7th, 8th, 9th, 10th, 11th, 12th' });
    }

    try {
        const updateData: any = {};
        if (nickname !== undefined) updateData.nickname = nickname;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (difficultyLevel !== undefined) updateData.difficultyLevel = difficultyLevel;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });
        res.json(updatedUser);
    } catch (e) {
        res.status(500).json({ error: "Failed to update settings" });
    }
});

router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const history = await prisma.testRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(history);
});

export default router;
