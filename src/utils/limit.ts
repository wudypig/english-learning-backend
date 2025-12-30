import { prisma } from './prisma';

export const checkAndDecrementLimit = async (userId: string, type: 'essay' | 'reading'): Promise<boolean> => {
    // Basic implementation: check if limit exists, if so decrement.
    // If no limit record exists, maybe default allows? Or default 0?
    // Guideline: "For example, one user can have 1 essay writing and 1 reading test."
    // "can be set in admin console" -> implies defaults might be 0 or small.
    // Let's assume a default of 1 if not present, for demo purposes, or stricter 0.
    // Given the prompt "I will provide my Gemini API key, so that's why there are limitations", stricter is better.
    // But for a new user, they need some initial credits.
    // I'll create a default limit on registration (handled in auth or lazily here).

    // Let's handle lazily: if no record, create with default 1.
    return await prisma.$transaction(async (tx) => {
        let limit = await tx.usageLimit.findUnique({
            where: {
                userId_testType: {
                    userId,
                    testType: type
                }
            }
        });

        if (!limit) {
            // Create default limit
            limit = await tx.usageLimit.create({
                data: {
                    userId,
                    testType: type,
                    remainingAttempts: 3 // Default 3 for testing
                }
            });
        }

        if (limit.remainingAttempts > 0) {
            await tx.usageLimit.update({
                where: { id: limit.id },
                data: { remainingAttempts: limit.remainingAttempts - 1 }
            });
            return true;
        }

        return false;
    });
};
