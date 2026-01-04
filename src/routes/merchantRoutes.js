import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import upload from '../config/upload.js';
import {
    login,
    changePassword,
    updateStatus,
    updateLocation,
    getOrders,
    getNearbyRiders,
    verifyRider,
    updateOrderStatus,
    notifyRiders,
    findByDispatchCode,
    getMarketingStats,
    getCampaigns,
    saveCampaign,
    unassignRider,
    releaseOrder,
    processBatch,
    updateProfile,
    getMenu,
    saveMenuItem,
    deleteMenuItem,
    uploadImage,
    getSalesHistory,
    getDiscounts,
    saveDiscount,
    deleteDiscount
} from '../controllers/merchantController.js';

const router = express.Router();

// Login
router.post('/login', login);

// Change merchant password
router.post('/change-password', verifyToken, changePassword);

// Update Status (Online/Offline)
router.post('/status', verifyToken, updateStatus);

// Update Merchant Location
router.patch('/location', verifyToken, updateLocation);

// Get Orders (Food & Store)
router.get('/orders', verifyToken, getOrders);

// Get nearby riders
router.get('/nearby-riders', verifyToken, getNearbyRiders);

// Verify Rider Code (Handoff)
router.post('/verify-rider', verifyToken, verifyRider);

// Update Order Status
router.post('/orders/:id/status', verifyToken, updateOrderStatus);

// Notify Closest Riders (Manual Trigger or Retry)
router.post('/orders/:id/notify-riders', verifyToken, notifyRiders);

// Find orders by dispatch code
router.get('/orders/by-dispatch-code', verifyToken, findByDispatchCode);


// --- MARKETING ROUTES ---

// Stats
router.get('/marketing/stats', verifyToken, getMarketingStats);

// Campaigns
router.get('/campaigns', verifyToken, getCampaigns);
router.post('/campaigns', verifyToken, saveCampaign);


// --- ORDER MANAGEMENT ---

// Unassign Rider (Resubmit)
router.post('/orders/:id/unassign', verifyToken, unassignRider);

// Release Order
router.post('/orders/:id/release', verifyToken, releaseOrder);

// Process Batch (Decline Items / Order)
router.post('/orders/:id/process-batch', verifyToken, processBatch);


// --- PROFILE & MENU ---

// Update Profile
router.put('/:id/update', verifyToken, updateProfile);

// Get Menu
router.get('/:id/menu', verifyToken, getMenu);

// Save Menu Item
router.post('/menu/save', verifyToken, saveMenuItem);

// Delete Menu Item
router.delete('/menu/:itemId', verifyToken, deleteMenuItem);

// Upload Image
// Middleware 'upload.single' processes the file, 'uploadImage' handles the response
router.post('/upload-image', verifyToken, upload.single('image'), uploadImage);


// --- SALES & DISCOUNTS ---

// Sales History
router.get('/sales-history', verifyToken, getSalesHistory);

// Get Discounts/Promos
router.get('/:id/discounts', verifyToken, getDiscounts);

// Save Discount
router.post('/discounts/save', verifyToken, saveDiscount);

// Delete Discount
router.delete('/discounts/:id', verifyToken, deleteDiscount);

export default router;
