/**
 * server.js - Hungr Backend
 * Complete version: Serves API + Frontend (dist) + Geocoding
 * Fixed: Port 3000, Geocoding Restored
 */

import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
// FIX: Set to 3000 to match Nginx config
const PORT = process.env.PORT || 3000;

// Helper for ESM directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT Secrets
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_change_this';
const JWT_EXPIRY = '15m'; 

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://nfcrevolution.com'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// --- SERVE STATIC FRONTEND (DIST) ---
app.use(express.static(path.join(__dirname, 'dist')));

// Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error connecting to MariaDB:', err.message);
    } else {
        console.log('✅ Connected to MariaDB database.');
        connection.release();
    }
});

// --- UTILS ---
const sendError = (res, statusCode, message, code = 'ERROR', sqlError = null) => {
    if (sqlError) console.error(`[SQL Error] ${sqlError.message}`);
    res.status(statusCode).json({ success: false, error: message, code });
};

const sendSuccess = (res, data, message = null) => {
    res.status(200).json({ success: true, data, ...(message && { message }) });
};

// --- AUTH MIDDLEWARE ---
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return sendError(res, 401, 'No token provided');

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return sendError(res, 403, 'Invalid token');
        req.user = decoded;
        next();
    });
};

const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

// ==========================================
// GEOCODING ENDPOINTS (RESTORED)
// ==========================================

// 1. Reverse Geocode (Coords -> Address)
app.get('/api/geocode/reverse', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return sendError(res, 400, 'Missing coordinates');

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'HungrApp/1.0' } });
        
        if (!response.ok) throw new Error('Nominatim API error');
        
        const data = await response.json();
        
        // Format the address nicely
        const address = data.address;
        const formattedAddress = [
            address.road,
            address.suburb,
            address.city || address.town,
        ].filter(Boolean).join(', ');

        sendSuccess(res, {
            address: formattedAddress || data.display_name,
            display_name: data.display_name
        });
    } catch (err) {
        console.error('Geocode Error:', err.message);
        sendError(res, 500, 'Geocoding failed');
    }
});

// 2. Search Address (Query -> Coords)
app.get('/api/geocode/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return sendError(res, 400, 'Missing query');

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1&countrycodes=ph`;
        const response = await fetch(url, { headers: { 'User-Agent': 'HungrApp/1.0' } });
        
        if (!response.ok) throw new Error('Nominatim API error');
        
        const data = await response.json();
        sendSuccess(res, data);
    } catch (err) {
        console.error('Search Error:', err.message);
        sendError(res, 500, 'Search failed');
    }
});

// ==========================================
// API ENDPOINTS
// ==========================================

// --- RESTAURANTS & MENU ---

// 1. Get All Restaurants
app.get('/api/restaurants', (req, res) => {
    db.query('SELECT * FROM restaurants ORDER BY rating DESC', (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

// 2. Get Menu for a Restaurant
app.get('/api/restaurants/:id/menu', (req, res) => {
    const restaurantId = req.params.id;
    const query = 'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name';
    
    db.query(query, [restaurantId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        
        // Group menu items by category for easier frontend rendering
        const menu = results.reduce((acc, item) => {
            const cat = item.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
        
        sendSuccess(res, menu);
    });
});

// --- PABILI SERVICE ---

// 3. Get Stores for Pabili
app.get('/api/pabili/stores', (req, res) => {
    const query = `
        SELECT id, name, address, image_url, delivery_time, rating 
        FROM stores WHERE is_active = 1 ORDER BY rating DESC
    `;
    db.query(query, (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

// 4. Create Pabili Order
app.post('/api/pabili/orders', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { storeId, items, estimatedCost, deliveryAddress } = req.body;

    const query = `
        INSERT INTO pabili_orders (user_id, merchant_id, items, estimated_cost, status, landmark)
        VALUES (?, ?, ?, ?, 'pending', ?)
    `;

    db.query(query, [userId, storeId, JSON.stringify(items), estimatedCost, deliveryAddress], (err, result) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, { orderId: result.insertId }, 'Order placed');
    });
});

// --- STANDARD ORDERS ---

// 5. Create Standard Food Order
app.post('/api/orders', verifyToken, (req, res) => {
    const { restaurantId, items, total } = req.body;
    const userId = req.user.userId;

    // Start transaction logic could be added here for robustness
    const orderQuery = 'INSERT INTO orders (user_id, restaurant_id, total_amount, status) VALUES (?, ?, ?, "pending")';
    
    db.query(orderQuery, [userId, restaurantId, total], (err, result) => {
        if (err) return sendError(res, 500, 'Failed to create order', 'DB_ERROR', err);
        
        const orderId = result.insertId;
        const orderItems = items.map(i => [orderId, i.id, i.quantity, i.price]);
        
        const itemsQuery = 'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ?';
        db.query(itemsQuery, [orderItems], (err) => {
            if (err) console.error('Error inserting items:', err); // Log but don't fail main request
            sendSuccess(res, { orderId }, 'Order placed successfully');
        });
    });
});

// --- USER DATA ---

// 6. Get User Addresses
app.get('/api/users/addresses', verifyToken, (req, res) => {
    db.query('SELECT * FROM user_addresses WHERE user_id = ?', [req.user.userId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

// 7. Save New Address
app.post('/api/users/addresses', verifyToken, (req, res) => {
    const { label, address, latitude, longitude } = req.body;
    const query = 'INSERT INTO user_addresses (user_id, label, address, latitude, longitude) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, [req.user.userId, label, address, latitude, longitude], (err, result) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, { id: result.insertId }, 'Address saved');
    });
});

// --- AUTHENTICATION ---

// 8. Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return sendError(res, 401, 'Invalid credentials');
        
        const user = results[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return sendError(res, 401, 'Invalid credentials');

        const token = generateToken(user.id);
        sendSuccess(res, { userId: user.id, username: user.username, accessToken: token });
    });
});

// 9. Signup
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, phone_number } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, email, password_hash, phone_number) VALUES (?, ?, ?, ?)', 
            [username, email, hash, phone_number], (err, result) => {
            if (err) return sendError(res, 400, 'User likely exists', 'DB_ERROR', err);
            
            const userId = result.insertId;
            const token = generateToken(userId);
            // Init empty wallet/coins
            db.query('INSERT INTO hungr_coins (user_id) VALUES (?)', [userId]);
            db.query('INSERT INTO wallets (user_id) VALUES (?)', [userId]);
            
            sendSuccess(res, { userId, username, accessToken: token });
        });
    } catch (e) {
        sendError(res, 500, 'Server Error');
    }
});

// --- CATCH-ALL ROUTE (FOR REACT) ---
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) {
        return sendError(res, 404, 'API Endpoint not found');
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, 'dist')}`);
});
