import { Router } from 'express';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/register', async (req, res) => {
    const { email, password, nickname } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with initial usage limits
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                nickname: nickname || email.split('@')[0],
                usageLimits: {
                    create: [
                        {
                            testType: 'essay',
                            remainingAttempts: 1
                        },
                        {
                            testType: 'reading',
                            remainingAttempts: 1
                        }
                    ]
                }
            },
        });

        res.json({ message: 'User created', userId: user.id });
    } catch (error) {
        res.status(400).json({ error: 'User already exists or invalid data' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin-only login endpoint
router.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                password: true,
                nickname: true,
                role: true,
                isActive: true
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Admin login failed' });
    }
});

export default router;
