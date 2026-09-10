import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log the incoming request
    console.log(`[${timestamp}] ${req.method} ${req.url}`);

    // Log request body for POST/PUT/PATCH requests (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive fields from logs
        if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
        if (sanitizedBody.accessToken) sanitizedBody.accessToken = '[REDACTED]';
        if (sanitizedBody.refreshToken) sanitizedBody.refreshToken = '[REDACTED]';
        console.log('  Body:', JSON.stringify(sanitizedBody, null, 2));
    }

    // Log query parameters if present
    if (Object.keys(req.query).length > 0) {
        console.log('  Query:', req.query);
    }

    // Capture the original end function
    const originalEnd = res.end;

    // Override res.end to log response details
    res.end = function (chunk?: any, encoding?: any, callback?: any): any {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
        console.log('---');

        // Call the original end function
        return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
};
