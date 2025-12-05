/**
 * server.js - Hungr Backend
 * Status: STABILITY FIX (Removed is_featured, Aggressive SPA Fallback)
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

// --- DEBUG LOGGING ---
app.use((req, res, next) => {
    // This helps us see in PM2 logs what paths are actually hitting the server
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// --- STATIC FILES ---
// Mount dist to /hungr so assets load correctly
app.use('/hungr', express.static(path.join(__dirname, 'dist')));
// Also mount to root as a backup
app.use(express.static(path.join(__dirname, 'dist')));

// --- DATABASE CONNECTION ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = {
    query: (sql, params, callback) => pool.query(sql, params, callback),
    execute: (sql, params) => pool.promise().execute(sql, params) 
};

// --- HELPER FUNCTIONS ---
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

const generateToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

// ==========================================
// ⛔ REGISTRATION CLOSED
// ==========================================
app.post('/api/auth/send-otp', (req, res) => sendError(res, 503, "Registration is closed for at the moment"));
app.post('/api/auth/register', (req, res) => sendError(res, 503, "Registration is closed for at the moment"));

// ==========================================
// 🛍️ PABILI API
// ==========================================
app.get('/api/pabili/stores', (req, res) => {
    const category = req.query.category;
    let query = 'SELECT * FROM stores';
    let params = [];
    if (category && category !== 'All') {
        query += ' WHERE category = ?';
        params.push(category);
    }
    
    // FIX: Removed 'is_featured' to prevent SQL crashes. Just sort by rating.
    query += ' ORDER BY rating DESC'; 
    
    db.query(query, params, (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        sendSuccess(res, results);
    });
});

app.get('/api/pabili/search', (req, res) => {
    const { q, lat, long } = req.query;
    if (!q) return sendError(res, 400, "Query required");
    
    let sql = `SELECT DISTINCT s.* FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ? LIMIT 20`;
    let params = [`%${q}%`, `%${q}%`, `%${q}%`];

    if (lat && long) {
        sql = `SELECT DISTINCT s.*, ( 6371 * acos( cos( radians(?) ) * cos( radians( s.latitude ) ) * cos( radians( s.longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( s.latitude ) ) ) ) AS distance FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE (s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ?) HAVING distance < 4 ORDER BY distance ASC LIMIT 20`;
        params = [lat, long, lat, `%${q}%`, `%${q}%`, `%${q}%`];
    }
    db.query(sql, params, (err, results) => {
        if (err) return sendError(res, 500, "DB Search Error", "DB_ERROR", err);
        sendSuccess(res, results);
    });
});

// ==========================================
// 🏪 MERCHANT API
// ==========================================
// Mount API Router for clean /api path handling
const apiRouter = express.Router();

apiRouter.post('/merchant/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM merchants WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return sendError(res, 401, 'Invalid credentials');
        const merchant = results[0];
        const valid = await bcrypt.compare(password, merchant.password_hash);
        if (!valid) return sendError(res, 401, 'Invalid credentials');
        const token = generateToken({ id: merchant.id, role: 'merchant', restaurantId: merchant.restaurant_id });
        sendSuccess(res, { id: merchant.id, name: merchant.name, email: merchant.email, phone_number: merchant.phone_number, restaurant_id: merchant.restaurant_id, accessToken: token });
    });
});

apiRouter.get('/merchant/orders', verifyToken, (req, res) => {
    const { restaurantId, role } = req.user;
    if (role !== 'merchant' || !restaurantId) return sendError(res, 403, 'Access denied');
    const query = `SELECT o.id, o.total_amount, o.status, o.created_at, u.username as customer_name, u.address as delivery_address, JSON_ARRAYAGG(JSON_OBJECT('id', oi.id, 'name', m.name, 'quantity', oi.quantity, 'price', oi.price_at_time)) as items FROM orders o JOIN users u ON o.user_id = u.id JOIN order_items oi ON o.id = oi.order_id JOIN menu_items m ON oi.menu_item_id = m.id WHERE o.restaurant_id = ? GROUP BY o.id ORDER BY o.created_at DESC`;
    db.query(query, [restaurantId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error', 'DB_ERROR', err);
        const orders = results.map(row => ({ ...row, items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items }));
        sendSuccess(res, orders);
    });
});

apiRouter.post('/merchant/orders/:id/status', verifyToken, (req, res) => {
    const { restaurantId, role } = req.user;
    const orderId = req.params.id;
    const { status } = req.body;
    if (role !== 'merchant') return sendError(res, 403, 'Access denied');
    db.query('UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?', [status, orderId, restaurantId], (err, result) => {
        if (err) return sendError(res, 500, 'Update failed');
        if (result.affectedRows === 0) return sendError(res, 404, 'Order not found');
        sendSuccess(res, { id: orderId, status }, 'Status updated');
    });
});

apiRouter.put('/merchant/:id/update', verifyToken, async (req, res) => {
    const merchantId = req.params.id;
    const { name, phone_number, restaurant_name, address, image_url, operating_hours, operating_days } = req.body;
    if (parseInt(req.user.id) !== parseInt(merchantId)) return sendError(res, 403, "Unauthorized");
    try {
        const [rows] = await db.execute('SELECT restaurant_id FROM merchants WHERE id = ?', [merchantId]);
        if (rows.length === 0) return sendError(res, 404, "Merchant not found");
        const restaurantId = rows[0].restaurant_id;
        await db.execute('UPDATE merchants SET name = ?, phone_number = ? WHERE id = ?', [name, phone_number, merchantId]);
        if (restaurantId) {
            await db.execute(`UPDATE restaurants SET name = ?, address = ?, image_url = ?, operating_hours = ?, operating_days = ? WHERE id = ?`, [restaurant_name, address, image_url, operating_hours, operating_days, restaurantId]);
        }
        const [updatedData] = await db.execute(`SELECT m.id, m.name, m.email, m.phone_number, m.restaurant_id, r.name as restaurant_name, r.address, r.image_url, r.operating_hours, r.operating_days FROM merchants m LEFT JOIN restaurants r ON m.restaurant_id = r.id WHERE m.id = ?`, [merchantId]);
        sendSuccess(res, updatedData[0], "Store settings updated");
    } catch (error) {
        console.error("Update Error:", error);
        sendError(res, 500, "Database update failed");
    }
});

apiRouter.get('/merchant/:id/menu', verifyToken, (req, res) => {
    db.query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name', [req.user.restaurantId], (err, results) => {
        if (err) return sendError(res, 500, 'DB Error');
        sendSuccess(res, results);
    });
});

apiRouter.post('/merchant/menu/save', verifyToken, (req, res) => {
    const { id, restaurant_id, name, description, price, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end } = req.body;
    if (req.user.restaurantId !== restaurant_id) return sendError(res, 403, "Unauthorized");
    const sql = id ? `UPDATE menu_items SET name=?, description=?, price=?, promotional_price=?, category=?, image_url=?, stock_quantity=?, is_available=?, food_type=?, cuisine_type=?, availability_start=?, availability_end=? WHERE id=? AND restaurant_id=?` : `INSERT INTO menu_items (name, description, price, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = id ? [name, description, price, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, id, restaurant_id] : [name, description, price, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, restaurant_id];
    db.query(sql, params, (err, result) => {
        if(err) return sendError(res, 500, "Save failed", "DB_ERROR", err);
        sendSuccess(res, { id: id || result.insertId }, "Item saved");
    });
});

apiRouter.delete('/merchant/menu/:itemId', verifyToken, (req, res) => {
    db.query('DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?', [req.params.itemId, req.user.restaurantId], (err) => {
        if(err) return sendError(res, 500, "Delete failed");
        sendSuccess(res, null, "Item deleted");
    });
});

apiRouter.get('/merchant/:id/discounts', verifyToken, async (req, res) => {
    const restaurantId = req.user.restaurantId;
    const [existing] = await db.execute('SELECT id FROM store_discounts WHERE restaurant_id = ? AND is_system_default = 1', [restaurantId]);
    if (existing.length === 0) {
        await db.execute(`INSERT INTO store_discounts (restaurant_id, name, discount_type, value, is_active, is_system_default, requirements) VALUES (?, 'Senior Citizen', 'percentage', 20.00, 1, 1, 'Valid Senior Citizen ID'), (?, 'PWD', 'percentage', 20.00, 1, 1, 'Valid PWD ID')`, [restaurantId, restaurantId]);
    }
    db.query('SELECT * FROM store_discounts WHERE restaurant_id = ? ORDER BY is_system_default DESC, name ASC', [restaurantId], (err, r) => err ? sendError(res, 500, 'DB Error') : sendSuccess(res, r));
});

apiRouter.post('/merchant/discounts/save', verifyToken, (req, res) => {
    const { id, restaurant_id, name, discount_type, value, is_active, requirements } = req.body;
    if (req.user.restaurantId !== restaurant_id) return sendError(res, 403, "Unauthorized");
    const sql = id ? 'UPDATE store_discounts SET name=?, discount_type=?, value=?, is_active=?, requirements=? WHERE id=? AND restaurant_id=?' : 'INSERT INTO store_discounts (name, discount_type, value, is_active, requirements, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)';
    const params = id ? [name, discount_type, value, is_active, requirements, id, restaurant_id] : [name, discount_type, value, is_active, requirements, restaurant_id];
    db.query(sql, params, (err, r) => err ? sendError(res, 500, "Save failed") : sendSuccess(res, { id: id || r.insertId }));
});

apiRouter.delete('/merchant/discounts/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM store_discounts WHERE id = ? AND restaurant_id = ? AND is_system_default = 0', [req.params.id, req.user.restaurantId], (err) => err ? sendError(res, 500, "Delete failed") : sendSuccess(res, null, "Discount deleted"));
});

// Customer Auth
apiRouter.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return sendError(res, 401, 'User not found');
        const user = results[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return sendError(res, 401, 'Invalid password');
        const token = generateToken({ id: user.id, role: user.user_type });
        sendSuccess(res, { id: user.id, username: user.username, email: user.email, token });
    });
});

apiRouter.get('/restaurants', (req, res) => { 
    db.query('SELECT * FROM restaurants ORDER BY rating DESC', (e,r) => e ? sendError(res,500,'DB Error') : sendSuccess(res,r)); 
});

// Mount Router
app.use('/api', apiRouter);
app.use('/hungr/api', apiRouter); // Support subpath API calls

// --- SPA CATCH-ALL (Fixes 404s) ---
app.get('*', (req, res) => {
    // If it starts with /api or /hungr/api, it's a real 404 from the API
    if (req.url.startsWith('/api/') || req.url.startsWith('/hungr/api/')) {
        return sendError(res, 404, 'API Endpoint not found');
    }
    // Otherwise, it's a frontend route (like /login or /hungr/login), so serve index.html
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (SPA Fallback Active)`);
});
