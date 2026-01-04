import { z } from 'zod';

export const createMerchantSchema = z.object({
    email: z.string().email("Invalid email address"),
    businessName: z.string().min(2, "Business name must be at least 2 characters"),
    businessType: z.enum(["restaurant", "store"], {
        errorMap: () => ({ message: "Business type must be either 'restaurant' or 'store'" })
    }),
    password: z.string().min(6, "Password must be at least 6 characters"),
    adminKey: z.string().min(1, "Admin key is required")
});

export const createRiderSchema = z.object({
    firstName: z.string().min(2, "First name is too short"),
    lastName: z.string().min(2, "Last name is too short"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    adminKey: z.string().min(1, "Admin key is required")
});
