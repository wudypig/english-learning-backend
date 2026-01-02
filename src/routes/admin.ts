import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// GET /admin/users - List all users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                difficultyLevel: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: {
                        testRecords: true,
                        usageLimits: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (e) {
        console.error('Error fetching users:', e);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /admin/users/:id - Get user details
router.get('/users/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                nickname: true,
                avatar: true,
                role: true,
                difficultyLevel: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (e) {
        console.error('Error fetching user:', e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// PUT /admin/users/:id - Update user
router.put('/users/:id', async (req, res) => {
    const { email, nickname, role, isActive } = req.body;

    try {
        const updateData: any = {};
        if (email) updateData.email = email;
        if (nickname !== undefined) updateData.nickname = nickname;
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                nickname: true,
                role: true,
                isActive: true,
                updatedAt: true
            }
        });

        res.json(user);
    } catch (e: any) {
        console.error('Error updating user:', e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: 'Email already in use' });
        }
        if (e.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// PUT /admin/users/:id/password - Reset password
router.put('/users/:id/password', async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.params.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password reset successfully' });
    } catch (e: any) {
        console.error('Error resetting password:', e);
        if (e.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// GET /admin/users/:id/limits - Get usage limits
router.get('/users/:id/limits', async (req, res) => {
    try {
        const limits = await prisma.usageLimit.findMany({
            where: { userId: req.params.id },
            orderBy: { testType: 'asc' }
        });
        res.json(limits);
    } catch (e) {
        console.error('Error fetching limits:', e);
        res.status(500).json({ error: 'Failed to fetch limits' });
    }
});

// PUT /admin/users/:id/limits - Update usage limits
router.put('/users/:id/limits', async (req, res) => {
    const { limits } = req.body; // Array of { testType, remainingAttempts }

    if (!Array.isArray(limits)) {
        return res.status(400).json({ error: 'Limits must be an array' });
    }

    try {
        const userId = req.params.id;

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update or create limits
        const updates = limits.map((limit: any) =>
            prisma.usageLimit.upsert({
                where: {
                    userId_testType: {
                        userId,
                        testType: limit.testType
                    }
                },
                update: {
                    remainingAttempts: limit.remainingAttempts
                },
                create: {
                    userId,
                    testType: limit.testType,
                    remainingAttempts: limit.remainingAttempts
                }
            })
        );

        const result = await Promise.all(updates);
        res.json(result);
    } catch (e) {
        console.error('Error updating limits:', e);
        res.status(500).json({ error: 'Failed to update limits' });
    }
});

export default router;
