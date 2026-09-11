import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    REFRESH_TOKEN_TTL_MS,
} from '../utils/tokenUtils';
import { sendVerificationEmail } from '../services/emailService';

const router = Router();

// Helper: create and persist a refresh token, return the raw token
const issueRefreshToken = async (userId: string, family: string): Promise<string> => {
    const raw = generateRefreshToken();
    const tokenHash = hashToken(raw);
    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash,
            family,
            used: false,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
    });
    return raw;
};

router.post('/register', async (req, res) => {
    const { email, password, nickname } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                nickname: nickname || email.split('@')[0],
                usageLimits: {
                    create: [
                        { testType: 'essay', remainingAttempts: 1 },
                        { testType: 'reading', remainingAttempts: 1 },
                    ],
                },
            },
        });

        const rawToken = crypto.randomBytes(32).toString('hex');
        const verificationToken = hashToken(rawToken);
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken, verificationTokenExpiry },
        });

        try {
            await sendVerificationEmail(email, rawToken);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
        }

        res.json({ message: 'Account created. Please check your email to verify your account.' });
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

        const family = crypto.randomUUID();
        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = await issueRefreshToken(user.id, family);

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, password: true, nickname: true, role: true, isActive: true },
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        const family = crypto.randomUUID();
        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = await issueRefreshToken(user.id, family);

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, isActive: user.isActive },
        });
    } catch (error) {
        res.status(500).json({ error: 'Admin login failed' });
    }
});

router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }

    const tokenHash = hashToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (record.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: record.id } });
        return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Reuse detection — wipe entire family and force re-login
    if (record.used) {
        await prisma.refreshToken.deleteMany({ where: { family: record.family } });
        return res.status(401).json({ error: 'Token reuse detected. Please log in again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Mark old token as used, issue new pair (same family)
    await prisma.refreshToken.update({ where: { id: record.id }, data: { used: true } });

    const accessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = await issueRefreshToken(user.id, record.family);

    res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    res.sendStatus(204);
});

export default router;
