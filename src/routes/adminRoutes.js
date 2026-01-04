import express from 'express';
import { createMerchant, createRider } from '../controllers/adminController.js';
import { validate } from '../middleware/validate.js';
import { createMerchantSchema, createRiderSchema } from '../schemas/adminSchemas.js';

const router = express.Router();

// ==========================================
// 👨‍💼 ADMIN API - Create Merchant Account
// ==========================================
router.post('/create-merchant', validate(createMerchantSchema), createMerchant);

// ==========================================
// 👨‍💼 ADMIN API - Create Rider Account
// ==========================================
router.post('/create-rider', validate(createRiderSchema), createRider);

export default router;
