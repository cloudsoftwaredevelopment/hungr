import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
    getUserAddresses,
    saveUserAddress,
    deleteUserAddress,
    updateUserLocation,
    getUserLocation,
    getMyRiderProfile,
    getPabiliStores,
    searchPabili,
    getStoreProducts,
    getPremiumRestaurants,
    getRestaurants,
    getRestaurantMenu,
    watchRestaurant,
    getOrderHistory,
    getActiveOrder,
    createPabiliOrder,
    cancelPabiliOrder,
    placeOrder
} from '../controllers/customerController.js';

import { validate } from '../middleware/validate.js';
import { placeOrderSchema, saveAddressSchema, updateLocationSchema } from '../schemas/customerSchemas.js';

const router = express.Router();

// ==========================================
// 👤 USER / PROFILE
// ==========================================

// Get user addresses
router.get('/users/addresses', verifyToken, getUserAddresses);

// Save user address
router.post('/users/addresses', verifyToken, validate(saveAddressSchema), saveUserAddress);

// Delete user address
router.delete('/users/addresses/:id', verifyToken, deleteUserAddress);

// Update user GPS location
router.patch('/users/location', verifyToken, validate(updateLocationSchema), updateUserLocation);

// Get user location
router.get('/users/location', verifyToken, getUserLocation);

// Get My Rider Profile (User checking if they are a rider)
router.get('/my-rider-profile', verifyToken, getMyRiderProfile);


// ==========================================
// 🛍️ RESTAURANTS & STORES
// ==========================================

// Get Pabili Stores
router.get('/pabili/stores', getPabiliStores);

// Pabili Search
router.get('/pabili/search', searchPabili);

// Get Store Products
router.get('/stores/:id/products', getStoreProducts);

// Get Premium Restaurants
router.get('/restaurants/premium', getPremiumRestaurants);

// Get Restaurants List
router.get('/restaurants', getRestaurants);

// Get Restaurant Menu (ID or Slug)
router.get('/restaurants/:idOrSlug/menu', getRestaurantMenu);

// Watch Restaurant
router.post('/restaurants/:id/watch', verifyToken, watchRestaurant);


// ==========================================
// 📦 ORDERS
// ==========================================

// Get Order History
router.get('/orders/history', verifyToken, getOrderHistory);

// Get Active Order
router.get('/orders/active', verifyToken, getActiveOrder);

// Pabili Orders
router.post('/pabili/orders', verifyToken, createPabiliOrder);

// Cancel Pabili Order
router.post('/pabili/orders/:id/cancel', verifyToken, cancelPabiliOrder);

// PLACE ORDER (Complex Logic)
router.post('/orders', verifyToken, validate(placeOrderSchema), placeOrder);

export default router;
