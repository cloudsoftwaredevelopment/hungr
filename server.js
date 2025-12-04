/**
 * server.js - Hungr Backend
 * Complete version: Serves API + Frontend (dist) + Geocoding
 * Fixed: Port 3000, Geocoding Restored, Profile Image Support, Increased Token Limit, Coin Support
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
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';
const JWT_EXPIRY = '24h'; 

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://nfcrevolution.com'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'dist')));

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
        
        // Auto-migration: Check/Add profile_image
        connection.query("SHOW COLUMNS FROM users LIKE 'profile_image'", (err, results) => {
            if (!err && results.length === 0) {
                connection.query("ALTER TABLE users ADD COLUMN profile_image LONGTEXT");
            }
        });

        // Auto-migration: Check/Add balance to hungr_coins if missing (safety check)
        connection.query("SHOW COLUMNS FROM hungr_coins LIKE 'balance'", (err, results) => {
            if (!err && results.length === 0) {
                // If it doesn't have balance, maybe it uses 'amount' or needs one. 
                // Based on signup 'INSERT INTO hungr_coins (user_id)...', it might be simpler to add 'balance'
                // But let's assume 'amount' was meant for balance if it exists, or add 'balance'
                console.log("⚠️ Checking hungr_coins table structure...");
                connection.query("ALTER TABLE hungr_coins ADD COLUMN balance INT DEFAULT 0", (err) => {
                    if (!err) console.log("✅ Column 'balance' added to hungr_coins.");
                });
            }
        });

        connection.release();
    }
});

const sendError = (res, statusCode, message, code = 'ERROR', sqlError = null) => {
    if (sqlError) console.error(`[SQL Error] ${sqlError.message}`);
    res.status(statusCode).json({ success: false, error: message, code });
};

const sendSuccess = (res, data, message = null) => {
    res.status(200).json({ success: true, data, ...(message && { message }) });
};

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

// --- GEOCODING ---
app.get('/api/geocode/reverse', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return sendError(res, 400, 'Missing coordinates');
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'HungrApp/1.0' } });
        if (!response.ok) throw new Error('Nominatim API error');
        const data = await response.json();
        const address = data.address;
        const formattedAddress = [address.road, address.suburb, address.city || address.town].filter(Boolean).join(', ');
        sendSuccess(res, { address: formattedAddress || data.display_name, display_name: data.display_name });
    } catch (err) { sendError(res, 500, 'Geocoding failed'); }
});

app.get('/api/geocode/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return sendError(res, 400, 'Missing query');
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1&countrycodes=ph`;
        const response = await fetch(url, { headers: { 'User-Agent': 'HungrApp/1.0' } });
        if (!response.ok) throw new Error('Nominatim API error');
        const data = await response.json();
        sendSuccess(res, data);
    } catch (err) { sendError(res, 500, 'Search failed'); }
});

// --- API ENDPOINTS ---

// Restaurants
app.get('/api/restaurants', (req, res) => {
    db.query('SELECT * FROM restaurants ORDER BY rating DESC', (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

app.get('/api/restaurants/:id/menu', (req, res) => {
    const restaurantId = req.params.id;
    const query = 'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name';
    db.query(query, [restaurantId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        const menu = results.reduce((acc, item) => {
            const cat = item.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});
        sendSuccess(res, menu);
    });
});

// Pabili
app.get('/api/pabili/stores', (req, res) => {
    db.query('SELECT id, name, address, image_url, delivery_time, rating FROM stores WHERE is_active = 1 ORDER BY rating DESC', (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

app.post('/api/pabili/orders', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { storeId, items, estimatedCost, deliveryAddress } = req.body;
    const query = `INSERT INTO pabili_orders (user_id, merchant_id, items, estimated_cost, status, landmark) VALUES (?, ?, ?, ?, 'pending', ?)`;
    db.query(query, [userId, storeId, JSON.stringify(items), estimatedCost, deliveryAddress], (err, result) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, { orderId: result.insertId }, 'Order placed');
    });
});

// Orders
app.post('/api/orders', verifyToken, (req, res) => {
    const { restaurantId, items, total } = req.body;
    const userId = req.user.userId;
    const orderQuery = 'INSERT INTO orders (user_id, restaurant_id, total_amount, status) VALUES (?, ?, ?, "pending")';
    db.query(orderQuery, [userId, restaurantId, total], (err, result) => {
        if (err) return sendError(res, 500, 'Failed to create order', 'DB_ERROR', err);
        const orderId = result.insertId;
        const orderItems = items.map(i => [orderId, i.id, i.quantity, i.price]);
        const itemsQuery = 'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ?';
        db.query(itemsQuery, [orderItems], (err) => {
            if (err) console.error('Error inserting items:', err);
            sendSuccess(res, { orderId }, 'Order placed successfully');
        });
    });
});

app.get('/api/orders/history', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const query = `
        SELECT id, 'food' as type, total_amount as amount, status, created_at, (SELECT name FROM restaurants WHERE id = orders.restaurant_id) as merchant_name FROM orders WHERE user_id = ?
        UNION
        SELECT id, 'pabili' as type, estimated_cost as amount, status, created_at, (SELECT name FROM stores WHERE id = pabili_orders.merchant_id) as merchant_name FROM pabili_orders WHERE user_id = ?
        ORDER BY created_at DESC
    `;
    db.query(query, [userId, userId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

// Addresses
app.get('/api/users/addresses', verifyToken, (req, res) => {
    db.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY id DESC', [req.user.userId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

app.post('/api/users/addresses', verifyToken, (req, res) => {
    const { label, address, latitude, longitude } = req.body;
    const query = 'INSERT INTO user_addresses (user_id, label, address, latitude, longitude) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [req.user.userId, label, address, latitude, longitude], (err, result) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, { id: result.insertId }, 'Address saved');
    });
});

// Wallet
app.get('/api/wallet', verifyToken, (req, res) => {
    const userId = req.user.userId;
    db.query('SELECT balance FROM wallets WHERE user_id = ?', [userId], (err, walletResults) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        const balance = walletResults.length > 0 ? walletResults[0].balance : 0;
        db.query('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId], (err, txResults) => {
            if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
            sendSuccess(res, { balance, transactions: txResults });
        });
    });
});

app.post('/api/wallet/topup', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { amount, method } = req.body;
    if (!amount || amount <= 0) return sendError(res, 400, 'Invalid amount');
    db.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId], (err) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        const recordTx = `INSERT INTO wallet_transactions (user_id, amount, type, payment_method, status, balance_after, description) VALUES (?, ?, 'topup', ?, 'success', (SELECT balance FROM wallets WHERE user_id = ?), 'Wallet Top-up')`;
        db.query(recordTx, [userId, amount, method, userId], (err) => {
            sendSuccess(res, { amount }, 'Top-up successful');
        });
    });
});

// --- COINS (NEW) ---
app.get('/api/coins', verifyToken, (req, res) => {
    const userId = req.user.userId;
    // We assume 'balance' column exists in hungr_coins, if not it will error, but we added auto-migration check
    db.query('SELECT balance FROM hungr_coins WHERE user_id = ?', [userId], (err, coinResults) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        const balance = coinResults.length > 0 ? coinResults[0].balance : 0;
        
        db.query('SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId], (err, txResults) => {
            if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
            sendSuccess(res, { balance, transactions: txResults });
        });
    });
});

app.post('/api/coins/earn', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { action } = req.body;
    
    // Define coin rewards
    let amount = 0;
    let description = '';
    
    switch(action) {
        case 'pickup_order': amount = 10; description = 'Pickup Order Reward'; break;
        case 'bulk_order': amount = 50; description = 'Bulk Order Reward'; break;
        case 'browse_menu': amount = 1; description = 'Browsing Reward'; break;
        case 'feedback': amount = 5; description = 'Feedback Reward'; break;
        default: return sendError(res, 400, 'Invalid action');
    }

    // 1. Update Coin Balance
    db.query('UPDATE hungr_coins SET balance = balance + ? WHERE user_id = ?', [amount, userId], (err) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        
        // 2. Record Transaction
        // Assuming balance_after can be fetched or calculated. For simplicity, fetching.
        const recordTx = `INSERT INTO coin_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'earned', ?, (SELECT balance FROM hungr_coins WHERE user_id = ?))`;
        
        db.query(recordTx, [userId, amount, description, userId], (err) => {
            if (err) console.error("Coin Tx Error", err);
            sendSuccess(res, { amount }, 'Coins earned');
        });
    });
});

// User Profile Update
app.post('/api/users/profile', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { profile_image } = req.body; 
    const query = 'UPDATE users SET profile_image = ? WHERE id = ?';
    db.query(query, [profile_image, userId], (err) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, { profile_image }, 'Profile updated');
    });
});

// Auth
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return sendError(res, 401, 'Invalid credentials');
        const user = results[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return sendError(res, 401, 'Invalid credentials');
        const token = generateToken(user.id);
        sendSuccess(res, { userId: user.id, username: user.username, email: user.email, phone_number: user.phone_number, address: user.address, profile_image: user.profile_image, accessToken: token });
    });
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, phone_number } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, email, password_hash, phone_number) VALUES (?, ?, ?, ?)', [username, email, hash, phone_number], (err, result) => {
            if (err) return sendError(res, 400, 'User likely exists', 'DB_ERROR', err);
            const userId = result.insertId;
            const token = generateToken(userId);
            // Initialize coins with balance 0
            db.query('INSERT INTO hungr_coins (user_id, balance) VALUES (?, 0)', [userId]);
            db.query('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [userId]);
            sendSuccess(res, { userId, username, accessToken: token });
        });
    } catch (e) {
        sendError(res, 500, 'Server Error');
    }
});

app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return sendError(res, 404, 'API Endpoint not found');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, 'dist')}`);
});
