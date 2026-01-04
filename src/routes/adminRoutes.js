import express from 'express';
import { createMerchant, createRider } from '../controllers/adminController.js';

const router = express.Router();

// ==========================================
// 👨‍💼 ADMIN API - Create Merchant Account
// ==========================================
router.post('/create-merchant', createMerchant);

// ==========================================
// 👨‍💼 ADMIN API - Create Rider Account
// ==========================================
router.post('/create-rider', createRider);

export default router;
