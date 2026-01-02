import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
};
