import { z } from 'zod';
import { sendError } from '../utils/response.js';

/**
 * Middleware factory for Zod validation
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 */
export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            const errors = err.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
            }));

            console.warn(`[Validation Failed] ${req.method} ${req.originalUrl}`, errors);
            return sendError(res, 400, "Validation Error", "VALIDATION_ERROR", errors);
        }
        next(err);
    }
};
