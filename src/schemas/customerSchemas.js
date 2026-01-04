import { z } from 'zod';

export const placeOrderSchema = z.object({
    restaurantId: z.number().int().optional(),
    storeId: z.number().int().optional(),
    orderType: z.enum(['food', 'store', 'ride']).optional(),
    total: z.number().min(0, "Total must be non-negative"),
    paymentMethod: z.string().min(1, "Payment method is required"),
    instructions: z.string().optional().nullable(),
    substitutionPreference: z.string().optional().nullable(),
    items: z.array(z.object({
        id: z.number().int().optional(),
        menu_item_id: z.number().int().optional(),
        name: z.string(),
        quantity: z.number().int().min(1),
        price: z.number().min(0).optional()
    })).optional()
}).refine(data => {
    // Ensure either restaurantId or storeId is present depending on implicit logic, or orderType is ride
    if (data.orderType === 'ride') return true;
    return !!(data.restaurantId || data.storeId);
}, {
    message: "Either restaurantId or storeId must be provided for food/store orders",
    path: ["restaurantId"]
});

export const saveAddressSchema = z.object({
    label: z.string().min(1, "Label is required"),
    address: z.string().min(5, "Address must be at least 5 characters"),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    is_default: z.boolean().optional()
});

export const updateLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional().nullable()
});
