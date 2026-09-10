import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const generateAccessToken = (userId: string, role: string): string => {
    const options: SignOptions = {
        expiresIn: (process.env.ACCESS_TOKEN_TTL || '1h') as SignOptions['expiresIn'],
    };
    return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, options);
};

export const generateRefreshToken = (): string => {
    return crypto.randomBytes(64).toString('hex');
};

export const hashToken = (raw: string): string => {
    return crypto.createHash('sha256').update(raw).digest('hex');
};
