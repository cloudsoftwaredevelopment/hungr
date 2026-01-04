import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
    toggleStatus,
    updateLocation,
    getAvailableOrders,
    acceptOrder,
    getWalletBalance,
    completeDelivery,
    getEarnings
} from '../controllers/riderController.js';

const router = express.Router();

// 1. Toggle Status
router.patch('/:id/status', verifyToken, toggleStatus);
router.post('/:id/status', verifyToken, toggleStatus); // POST Alternative

// 2. Update Rider Location (called every 10 seconds when online)
router.patch('/:id/location', verifyToken, updateLocation);
router.post('/:id/location', verifyToken, updateLocation); // POST Alternative

// 3. Get Available Orders (includes both Store and Food orders)
router.get('/:id/orders', verifyToken, getAvailableOrders);

// 4. Accept Order
router.post('/:id/orders/:orderId/accept', verifyToken, acceptOrder);

// 5. Get Rider Wallet Balance
router.get('/:id/wallet', verifyToken, getWalletBalance);

// 5b. Mark Delivery as Complete
router.post('/:id/orders/:orderId/complete', verifyToken, completeDelivery);

// 6. Get Rider Earnings History
router.get('/:id/earnings', verifyToken, getEarnings);

export default router;
