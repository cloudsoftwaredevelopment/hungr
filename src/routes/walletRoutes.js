
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as walletController from '../controllers/walletController.js';
import { getCustomerBalance, processCustomerPayment } from '../services/walletService.js';

// Re-export services for backward compatibility
export { getCustomerBalance, processCustomerPayment };

const router = express.Router();

// ==========================================
// 💰 MERCHANT WALLET API
// ==========================================
router.get('/merchant/wallet', verifyToken, walletController.getMerchantWallet);
router.get('/merchant/wallet/ledger', verifyToken, walletController.getMerchantLedger);
router.post('/merchant/wallet/topup', verifyToken, walletController.submitMerchantTopup);
router.get('/merchant/wallet/requests', verifyToken, walletController.getMerchantRequests);

// 2FA (TOTP)
router.post('/merchant/wallet/2fa/setup', verifyToken, walletController.setup2FA);
router.post('/merchant/wallet/2fa/verify', verifyToken, walletController.verify2FA);
router.post('/merchant/wallet/2fa/disable', verifyToken, walletController.disable2FA);

// Withdrawals
router.post('/merchant/wallet/withdraw', verifyToken, walletController.withdraw);
router.get('/merchant/wallet/withdrawals', verifyToken, walletController.getWithdrawals);

// ==========================================
// 👤 CUSTOMER WALLET API
// ==========================================
router.get('/wallet', verifyToken, walletController.getCustomerWallet);
router.get('/wallet/history', verifyToken, walletController.getCustomerWalletHistory);
router.post('/wallet/topup', verifyToken, walletController.submitCustomerTopup);
router.get('/wallet/requests', verifyToken, walletController.getCustomerRequests);

// ==========================================
// 🏍️ RIDER WALLET API
// ==========================================
router.get('/rider/wallet', verifyToken, walletController.getRiderWallet); // Handles riderId from token or param logic in controller
router.post('/rider/wallet/topup', verifyToken, walletController.submitRiderTopup);

// Rider Profile (merged into wallet routes in original file)
router.get('/rider/profile', verifyToken, walletController.getRiderProfile);
router.put('/rider/profile', verifyToken, walletController.updateRiderProfile);
router.post('/rider/profile/photo', verifyToken, walletController.uploadRiderPhoto);
router.post('/rider/password/reset', verifyToken, walletController.resetRiderPassword);

// ==========================================
// 🪙 HUNGR COINS API
// ==========================================

// Merchant Coins
router.get('/merchant/coins', verifyToken, walletController.getMerchantCoins);
router.post('/merchant/coins/topup', verifyToken, walletController.submitMerchantCoinTopup);
router.post('/merchant/coins/award', verifyToken, walletController.awardCoinsToCustomer);

// Rider Coins
router.get('/rider/coins', verifyToken, walletController.getRiderCoins);
router.post('/rider/coins/topup', verifyToken, walletController.submitRiderCoinTopup);
router.post('/rider/coins/award', verifyToken, walletController.awardCoinsToCustomerFromRider);

// Customer Coins
router.get('/coins', verifyToken, walletController.getCustomerCoins);
router.get('/coins/history', verifyToken, walletController.getCustomerCoinHistory);
router.post('/coins/earn', verifyToken, walletController.triggerCoinEarning);


// ==========================================
// 🛡️ ADMIN API (Wallet & Coins)
// ==========================================
// Note: VerifyToken is used here. In original file verifyAdminToken was used but not defined in view.
// Controller logic should eventually check roles.

// Merchant Top-ups
router.get('/admin/wallet/requests', verifyToken, walletController.getPendingRequests);
router.post('/admin/wallet/requests/:id/approve', verifyToken, walletController.approveTopup);
router.post('/admin/wallet/requests/:id/reject', verifyToken, walletController.rejectTopup);

// Customer Top-ups
router.get('/admin/wallet/customer-requests', verifyToken, walletController.getCustomerRequestsInAdmin);
router.post('/admin/wallet/customer-requests/:id/approve', verifyToken, walletController.approveCustomerRequestInAdmin);
router.post('/admin/wallet/customer-requests/:id/reject', verifyToken, walletController.rejectCustomerRequestInAdmin);

// Rider Top-ups
router.get('/admin/wallet/rider-requests', verifyToken, walletController.getRiderRequestsInAdmin);
router.post('/admin/wallet/rider-requests/:id/approve', verifyToken, walletController.approveRiderRequestInAdmin);
router.post('/admin/wallet/rider-requests/:id/reject', verifyToken, walletController.rejectRiderRequestInAdmin);

// Merchant Coins
router.get('/admin/coins/merchant-requests', verifyToken, walletController.getMerchantCoinRequestsInAdmin);
router.post('/admin/coins/merchant-requests/:id/approve', verifyToken, walletController.approveMerchantCoinRequest);
router.post('/admin/coins/merchant-requests/:id/reject', verifyToken, walletController.rejectMerchantCoinRequest);

// Rider Coins
router.get('/admin/coins/rider-requests', verifyToken, walletController.getRiderCoinRequestsInAdmin);
router.post('/admin/coins/rider-requests/:id/approve', verifyToken, walletController.approveRiderCoinRequest);
router.post('/admin/coins/rider-requests/:id/reject', verifyToken, walletController.rejectRiderCoinRequest);


// ==========================================
// 📄 INVOICE API
// ==========================================
router.get('/wallet/invoice/:type/:id', verifyToken, walletController.downloadInvoice);


console.log('💰 Wallet & Coin API routes registered (Controller-based)');

export default router;
