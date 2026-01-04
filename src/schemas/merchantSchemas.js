import { z } from 'zod';

export const updateStatusSchema = z.object({
    isOnline: z.boolean({ required_error: "isOnline boolean is required" })
});

export const updateMerchantLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional().nullable()
});

export const notifyRidersSchema = z.object({
    type: z.enum(['food', 'store']).optional()
});
