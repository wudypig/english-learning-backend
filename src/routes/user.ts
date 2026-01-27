import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            usageLimits: true,
            testRecords: {
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    });

    // Extract history from user object
    const history = user?.testRecords || [];
    const userWithoutRecords = user ? { ...user, testRecords: undefined } : null;

    res.json({ user: userWithoutRecords, history });
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            testRecords: {
                orderBy: { createdAt: 'desc' }
            }
        }
    });
    res.json(user?.testRecords || []);
});

// Search users by nickname or email
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const query = req.query.q as string;

        if (!query || query.trim().length === 0) {
            return res.json([]);
        }

        const searchTerm = query.trim().toLowerCase();

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { nickname: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } }
                ],
                isActive: true
            },
            select: {
                id: true,
                nickname: true,
                email: true,
                avatar: true
            },
            take: 20
        });

        res.json(users);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Helper function to get or create privacy settings
async function getOrCreatePrivacySettings(userId: string) {
    let settings = await prisma.userPrivacySettings.findUnique({
        where: { userId }
    });

    if (!settings) {
        settings = await prisma.userPrivacySettings.create({
            data: {
                userId,
                dashboardVisibility: 'private',
                activitiesVisibility: 'private'
            }
        });
    }

    return settings;
}

// Helper function to calculate dashboard statistics
async function calculateDashboardStats(userId: string) {
    const testRecords = await prisma.testRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });

    const totalTests = testRecords.length;

    const essayTests = testRecords.filter(t => t.type === 'essay');
    const readingTests = testRecords.filter(t => t.type === 'reading');

    const averageEssayScore = essayTests.length > 0
        ? essayTests.reduce((sum, t) => sum + t.score, 0) / essayTests.length
        : 0;

    const averageReadingScore = readingTests.length > 0
        ? readingTests.reduce((sum, t) => sum + t.score, 0) / readingTests.length
        : 0;

    // Calculate current streak
    let currentStreak = 0;
    if (testRecords.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sortedRecords = [...testRecords].sort((a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        );

        let currentDate = new Date(today);
        for (const record of sortedRecords) {
            const recordDate = new Date(record.createdAt);
            recordDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((currentDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0 || diffDays === 1) {
                if (diffDays === 1) {
                    currentStreak++;
                    currentDate = recordDate;
                }
            } else {
                break;
            }
        }

        // Check if there's a test today or yesterday
        if (sortedRecords.length > 0) {
            const lastTestDate = new Date(sortedRecords[0].createdAt);
            lastTestDate.setHours(0, 0, 0, 0);
            const diffFromToday = Math.floor((today.getTime() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffFromToday <= 1) {
                currentStreak++;
            }
        }
    }

    const recentActivities = testRecords.slice(0, 5).map(record => ({
        id: record.id,
        type: record.type,
        score: record.score,
        createdAt: record.createdAt
    }));

    return {
        totalTests,
        averageEssayScore: Math.round(averageEssayScore * 10) / 10,
        averageReadingScore: Math.round(averageReadingScore * 10) / 10,
        currentStreak,
        recentActivities
    };
}

// Get user dashboard (requires public visibility)
router.get('/:userId/dashboard', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { userId } = req.params;

        // Check if user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                nickname: true,
                email: true,
                avatar: true,
                isActive: true
            }
        });

        if (!targetUser || !targetUser.isActive) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get privacy settings
        const privacySettings = await getOrCreatePrivacySettings(userId);

        // Check if dashboard is public
        if (privacySettings.dashboardVisibility === 'private') {
            return res.status(403).json({
                error: 'This user\'s dashboard is private',
                isPrivate: true
            });
        }

        // Calculate statistics
        const stats = await calculateDashboardStats(userId);

        res.json({
            user: targetUser,
            ...stats
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch user dashboard' });
    }
});

// Get user activities (requires public visibility)
router.get('/:userId/activities', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        // Check if user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, isActive: true }
        });

        if (!targetUser || !targetUser.isActive) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get privacy settings
        const privacySettings = await getOrCreatePrivacySettings(userId);

        // Check if activities are public
        if (privacySettings.activitiesVisibility === 'private') {
            return res.status(403).json({
                error: 'This user\'s activities are private',
                isPrivate: true
            });
        }

        // Fetch activities
        const activities = await prisma.testRecord.findMany({
            where: { userId },
            select: {
                id: true,
                type: true,
                score: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json(activities);
    } catch (error) {
        console.error('Activities error:', error);
        res.status(500).json({ error: 'Failed to fetch user activities' });
    }
});

// Get current user's privacy settings
router.get('/privacy-settings', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const settings = await getOrCreatePrivacySettings(userId);
        res.json(settings);
    } catch (error) {
        console.error('Get privacy settings error:', error);
        res.status(500).json({ error: 'Failed to get privacy settings' });
    }
});

// Update current user's privacy settings
router.put('/privacy-settings', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { dashboardVisibility, activitiesVisibility } = req.body;

        // Validate visibility values
        const validValues = ['private', 'public'];
        if (dashboardVisibility && !validValues.includes(dashboardVisibility)) {
            return res.status(400).json({
                error: 'Invalid dashboardVisibility. Must be "private" or "public"'
            });
        }
        if (activitiesVisibility && !validValues.includes(activitiesVisibility)) {
            return res.status(400).json({
                error: 'Invalid activitiesVisibility. Must be "private" or "public"'
            });
        }

        // Update or create settings
        const updateData: any = {};
        if (dashboardVisibility !== undefined) updateData.dashboardVisibility = dashboardVisibility;
        if (activitiesVisibility !== undefined) updateData.activitiesVisibility = activitiesVisibility;

        const settings = await prisma.userPrivacySettings.upsert({
            where: { userId },
            update: updateData,
            create: {
                userId,
                dashboardVisibility: dashboardVisibility || 'private',
                activitiesVisibility: activitiesVisibility || 'private'
            }
        });

        res.json(settings);
    } catch (error) {
        console.error('Update privacy settings error:', error);
        res.status(500).json({ error: 'Failed to update privacy settings' });
    }
});

export default router;

