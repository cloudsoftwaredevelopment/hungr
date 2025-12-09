/**
 * server.js - Hungr Backend
 * Status: STABILITY FIX (Removed is_featured, Aggressive SPA Fallback)
 * Updated: Handling Store Paid Orders & Rider Allocation
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
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/hungr/socket.io',
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173', 'https://nfcrevolution.com'],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Generating temporary secret for dev mode.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_' + Date.now();
const JWT_EXPIRY = '24h';

// Haversine formula to calculate distance between two lat/lng points (in km)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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
// Explicitly serve Merchant App
app.use('/hungrmerchant', express.static(path.join(__dirname, '../hungr-merchant/dist')));

// Also mount to root as a backup (for customer app usually)
app.use(express.static(path.join(__dirname, 'dist')));

// --- UPLOADS DIRECTORY SETUP ---
const uploadsDir = path.join(__dirname, 'uploads', 'menu');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/hungr/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'menu-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

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

// Ensure Tables Exist
(async () => {
    try {
        const poolPromise = pool.promise();

        // FORCE RESET SCHEMA (Fixing missing columns)
        await poolPromise.execute('DROP TABLE IF EXISTS pabili_items');
        await poolPromise.execute('DROP TABLE IF EXISTS pabili_orders');
        console.log("Dropped Pabili tables for schema reset.");

        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS pabili_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                store_id INT NOT NULL,
                rider_id INT DEFAULT NULL,
                estimated_cost DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'accepted', 'purchasing', 'delivering', 'completed', 'cancelled') DEFAULT 'pending',
                delivery_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS pabili_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pabili_order_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                quantity VARCHAR(100) NOT NULL,
                FOREIGN KEY (pabili_order_id) REFERENCES pabili_orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS cancelled_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'pabili', 'mart') DEFAULT 'pabili',
                rider_id INT NOT NULL,
                reason TEXT,
                cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS declined_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'store') DEFAULT 'food',
                item_name VARCHAR(255),
                quantity INT,
                reason TEXT,
                declined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS prepared_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'store') DEFAULT 'food',
                restaurant_id INT,
                accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ready_at TIMESTAMP NULL
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS store_paid_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                store_id INT NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50),
                status ENUM('pending', 'paid', 'assigned', 'completed', 'cancelled') DEFAULT 'pending',
                delivery_address TEXT,
                rider_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);
        // Note: We might need a store_order_items table too, but for now assuming items are JSON or simplified
        // Let's create store_order_items to be safe and structured
        await poolPromise.execute(`
             CREATE TABLE IF NOT EXISTS store_order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT, 
                product_name VARCHAR(255),
                quantity INT,
                price DECIMAL(10,2),
                FOREIGN KEY (order_id) REFERENCES store_paid_orders(id) ON DELETE CASCADE
             ) ENGINE=InnoDB;
        `);

        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS ride_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                pickup_lat DECIMAL(10, 8),
                pickup_lon DECIMAL(11, 8),
                pickup_address TEXT,
                dropoff_lat DECIMAL(10, 8),
                dropoff_lon DECIMAL(11, 8),
                dropoff_address TEXT,
                fare DECIMAL(10,2) NOT NULL,
                distance_km DECIMAL(10,2),
                status ENUM('pending', 'accepted', 'in_transit', 'completed', 'cancelled') DEFAULT 'pending',
                rider_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);

        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS restaurant_watchers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                restaurant_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_watcher (user_id, restaurant_id)
            ) ENGINE=InnoDB;
        `);

        // Add cost column to menu_items if it doesn't exist
        try {
            await poolPromise.execute(`
                ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0.00
            `);
            console.log("menu_items.cost column checked/added.");
        } catch (e) {
            // Column might already exist in some DB versions that don't support IF NOT EXISTS
            console.log("menu_items.cost column might already exist.");
        }

        // Add cost_at_time column to order_items if it doesn't exist
        try {
            await poolPromise.execute(`
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_time DECIMAL(10,2) DEFAULT 0.00
            `);
            console.log("order_items.cost_at_time column checked/added.");
        } catch (e) {
            console.log("order_items.cost_at_time column might already exist.");
        }

        console.log("Pabili and Store tables checked/created.");
    } catch (e) {
        console.error("Table Init Error:", e);
    }
})();

const db = {
    // Helper to return just the rows from a query
    query: async (sql, params) => {
        const [results] = await pool.promise().query(sql, params);
        return results;
    },
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

// Haversine Algo
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

app.post('/api/orders', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { restaurantId, storeId, orderType, items, total, paymentMethod } = req.body;

        if (orderType === 'store' && storeId) {
            // === HANDLING STORE ORDER ===

            // 1. Create Order
            // Find user address for delivery (Mocking: using active address or default)
            const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
            const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";
            // Get user Coords for rider matching
            const userLat = addrRows.length > 0 ? addrRows[0].latitude : 14.5995; // Default Manila
            const userLong = addrRows.length > 0 ? addrRows[0].longitude : 120.9842;

            const [orderResult] = await db.execute(
                `INSERT INTO store_paid_orders (user_id, store_id, total_amount, payment_method, delivery_address, status) VALUES (?, ?, ?, ?, ?, 'paid')`,
                [userId, storeId, total, paymentMethod, deliveryAddress]
            );
            const orderId = orderResult.insertId;

            // 2. Insert Items
            // 2. Insert Items
            if (items && items.length > 0) {
                const itemValues = items.map(i => [orderId, i.id, i.name, i.quantity, i.price || 0]);
                await db.query('INSERT INTO store_order_items (order_id, product_id, product_name, quantity, price) VALUES ?', [itemValues]);
            }

            // 3. Rider Allocation (Haversine)
            // Fetch Store Coords (Mocking if missing)
            // Note: 'stores' table might not have lat/long yet, using defaults if missing.
            const [storeRows] = await db.execute('SELECT * FROM stores WHERE id = ?', [storeId]);
            const storeData = storeRows[0] || {};
            const storeLoc = {
                latitude: storeData.latitude || 10.7202,
                longitude: storeData.longitude || 122.5621
            };

            // Use correct columns for riders: current_latitude, current_longitude
            const [onlineRiders] = await db.execute('SELECT id, name, current_latitude as latitude, current_longitude as longitude FROM riders WHERE is_online = 1');

            const ridersWithDistance = onlineRiders.map(r => ({
                ...r,
                distance: getDistance(storeLoc.latitude, storeLoc.longitude, r.latitude, r.longitude)
            })).sort((a, b) => a.distance - b.distance);

            const closestRiders = ridersWithDistance.slice(0, 10);

            // 4. Notify Riders (Mock Notification)
            console.log(`[StoreOrder #${orderId}] Payment Successful. Notifying 10 closest riders:`);
            closestRiders.forEach(r => console.log(` - Rider ${r.name} (${r.distance.toFixed(2)}km away)`));

            // 5. Notify Merchant (Mock -> Real Socket)
            console.log(`[StoreOrder #${orderId}] Notifying Store Merchant of new order.`);

            // Emit to all connected clients (or use rooms for specific merchants in future)
            io.emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                type: 'store',
                customer_name: 'New Customer', // You might want to fetch this
                created_at: new Date(),
                items: items,
                delivery_address: deliveryAddress
            });

            return sendSuccess(res, { orderId, ridersNotified: closestRiders.length }, "Order placed successfully");

        } else if (orderType === 'ride') {
            // === HANDLING RIDE ORDER ===
            const { pickup, dropoff, fare, distance } = req.body;

            const [resOrder] = await db.execute(
                `INSERT INTO ride_orders 
                (user_id, pickup_lat, pickup_lon, pickup_address, dropoff_lat, dropoff_lon, dropoff_address, fare, distance_km, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [userId, pickup.lat, pickup.lon, pickup.address, dropoff.lat, dropoff.lon, dropoff.address, fare, distance]
            );
            const orderId = resOrder.insertId;

            // Rider Allocation (Haversine from Pickup Location)
            const [onlineRiders] = await db.execute('SELECT id, name, latitude, longitude FROM riders WHERE is_online = 1');

            const ridersWithDistance = onlineRiders.map(r => ({
                ...r,
                distance: getDistance(pickup.lat, pickup.lon, r.latitude, r.longitude)
            })).sort((a, b) => a.distance - b.distance);

            const closestRiders = ridersWithDistance.slice(0, 10);

            console.log(`[RideOrder #${orderId}] Booking Request. Notifying 10 closest riders to Pickup Point:`);
            closestRiders.forEach(r => console.log(` - Rider ${r.name} (${r.distance.toFixed(2)}km away)`));

            return sendSuccess(res, { orderId, ridersNotified: closestRiders.length }, "Ride booked successfully");

        } else {
            // === HANDLING RESTAURANT ORDER ===
            if (!restaurantId) return sendError(res, 400, "Restaurant ID required");

            // CHECK RESTAURANT AVAILABILITY (Offline Check)
            const [restCheck] = await db.execute('SELECT is_available FROM restaurants WHERE id = ?', [restaurantId]);
            if (!restCheck.length || restCheck[0].is_available === 0) {
                return sendError(res, 400, "Restaurant is currently offline/closed.");
            }

            // Fetch user address for delivery
            const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
            const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";

            // Create Order
            const [resOrder] = await db.execute(
                `INSERT INTO orders (user_id, restaurant_id, total_amount, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`,
                [userId, restaurantId, total || 0]
            );

            const orderId = resOrder.insertId;

            // INSERT ORDER ITEMS
            if (items && items.length > 0) {
                for (const item of items) {
                    const itemId = item.id || item.menu_item_id;
                    if (!itemId) continue;
                    await db.execute(
                        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)`,
                        [orderId, itemId, item.quantity || 1, item.price || 0]
                    );
                }
            }

            // Emit socket event with FULL details (including items) so merchant dashboard can display it immediately
            io.emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                type: 'food',
                customer_name: 'Customer', // In real app, fetch user name
                created_at: new Date(),
                restaurant_id: restaurantId,
                items: items || [], // Pass the original items array from request so UI has data
                delivery_address: deliveryAddress || 'TBA'
            });

            return sendSuccess(res, { orderId: orderId }, "Food Order placed successfully");
        }
    } catch (err) {
        sendError(res, 500, "Order Creation Failed", "DB_ERROR", err);
    }
});

// ==========================================
// ⛔ REGISTRATION CLOSED
// ==========================================
app.post('/api/auth/send-otp', (req, res) => sendError(res, 503, "Registration is closed for at the moment"));
app.post('/api/auth/register', (req, res) => sendError(res, 503, "Registration is closed for at the moment"));

// ==========================================
// 🛍️ PABILI API
// ==========================================
app.get('/api/pabili/stores', async (req, res) => {
    try {
        const category = req.query.category;
        let query = 'SELECT * FROM stores';
        let params = [];
        if (category && category !== 'All') {
            query += ' WHERE category = ?';
            params.push(category);
        }

        // FIX: Removed 'is_featured' to prevent SQL crashes. Just sort by rating.
        query += ' ORDER BY rating DESC';

        const results = await db.query(query, params);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
});

// ==========================================
// 🛒 PABILI ORDER API
// ==========================================

app.post('/api/pabili/orders', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { store_id, items, estimated_cost, delivery_address } = req.body;

        if (!store_id || !items || !items.length || !estimated_cost) {
            return sendError(res, 400, "Missing required fields");
        }

        // 1. Create Order
        const [orderResult] = await db.execute(
            `INSERT INTO pabili_orders (user_id, store_id, estimated_cost, delivery_address, status) VALUES (?, ?, ?, ?, 'pending')`,
            [userId, store_id, estimated_cost, delivery_address || '']
        );
        const pabiliId = orderResult.insertId;

        // 2. Insert Items
        for (const item of items) {
            await db.execute(
                `INSERT INTO pabili_items (pabili_order_id, name, quantity) VALUES (?, ?, ?)`,
                [pabiliId, item.name, item.quantity]
            );
        }

        // 3. Find Riders (Mock Logic for now: Find online riders with wallet balance > estimated_cost)
        // In a real app, we'd query 'riders' table. For now, we mock the matching logic.
        // Assuming 'riders' table has 'is_online' and 'wallet_balance' (joined from wallets logic if needed)

        const riders = await db.query(`
            SELECT r.id, r.name, w.balance 
            FROM riders r 
            JOIN wallets w ON r.user_id = w.user_id 
            WHERE r.is_online = 1 AND w.balance >= ? 
            LIMIT 10
        `, [estimated_cost]);

        console.log(`[Pabili] Order #${pabiliId} created. Notifying ${riders.length} riders:`, riders.map(r => r.name));

        sendSuccess(res, { orderId: pabiliId, ridersNotified: riders.length }, "Order created and riders notified");

    } catch (err) {
        sendError(res, 500, "Failed to create Pabili order", "DB_ERROR", err);
    }
});

app.post('/api/pabili/orders/:id/cancel', verifyToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { rider_id, reason } = req.body; // In real app, rider_id comes from token if rider cancels

        // Simulating Rider Cancellation
        // 1. Log Cancellation
        await db.execute(
            `INSERT INTO cancelled_orders (order_id, order_type, rider_id, reason) VALUES (?, 'pabili', ?, ?)`,
            [orderId, rider_id, reason || 'Rider cancelled']
        );

        // 2. Reset Order to Pending
        await db.execute(
            `UPDATE pabili_orders SET status = 'pending', rider_id = NULL WHERE id = ?`,
            [orderId]
        );

        // 3. Notify User (Log)
        console.log(`[Pabili] Order #${orderId} was cancelled by Rider #${rider_id}. Status reset to PENDING.`);

        sendSuccess(res, null, "Order cancelled and reset to pending");

    } catch (err) {
        sendError(res, 500, "Cancellation failed");
    }
});

app.get('/api/pabili/search', async (req, res) => {
    try {
        const { q, lat, long } = req.query;
        if (!q) return sendError(res, 400, "Query required");

        let sql = `SELECT DISTINCT s.* FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ? LIMIT 20`;
        let params = [`%${q}%`, `%${q}%`, `%${q}%`];

        if (lat && long) {
            sql = `SELECT DISTINCT s.*, ( 6371 * acos( cos( radians(?) ) * cos( radians( s.latitude ) ) * cos( radians( s.longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( s.latitude ) ) ) ) AS distance FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE (s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ?) HAVING distance < 4 ORDER BY distance ASC LIMIT 20`;
            params = [lat, long, lat, `%${q}%`, `%${q}%`, `%${q}%`];
        }
        const results = await db.query(sql, params);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, "DB Search Error", "DB_ERROR", err);
    }
});

app.get('/api/stores/:id/products', async (req, res) => {
    try {
        const storeId = req.params.id;
        const products = await db.query('SELECT * FROM products WHERE store_id = ?', [storeId]);
        sendSuccess(res, products);
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
});

// ==========================================
// 🏍️ RIDER API
// ==========================================

// 1. Get Rider Profile
app.get('/api/my-rider-profile', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.execute('SELECT * FROM riders WHERE user_id = ?', [userId]);
        if (rows.length === 0) return sendError(res, 404, "Rider profile not found");
        sendSuccess(res, rows[0]);
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
});

// 2. Toggle Status
app.patch('/api/riders/:id/status', verifyToken, async (req, res) => {
    try {
        const { isOnline } = req.body;
        await db.execute('UPDATE riders SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, req.params.id]);
        sendSuccess(res, { isOnline }, "Status updated");
    } catch (err) {
        sendError(res, 500, "Update failed");
    }
});

// 3. Get Available Orders (For now, simplified to show ALL pending store orders to ALL online riders, or strictly assigned ones)
// The Haversine algo notified them, but we need an endpoint for them to "poll" or "see" the orders.
// We will return pending Store Orders that are NOT yet assigned.
app.get('/api/riders/:id/orders', verifyToken, async (req, res) => {
    try {
        const riderId = req.params.id;

        // Fetch Store Paid Orders that are 'paid' (ready for pickup) and rider_id is NULL
        // In a real app, we might filter by proximity again or check a 'notifications' table.
        // For MVP/Demo: Return ALL pending store orders to the rider.
        const storeOrders = await db.query(`
            SELECT o.id, o.total_amount as fee, s.name as title, s.address as pickup_location, 'store' as order_type
            FROM store_paid_orders o
            JOIN stores s ON o.store_id = s.id
            WHERE o.status = 'paid' AND o.rider_id IS NULL
            ORDER BY o.created_at DESC
        `);

        // You can join with other order types here if needed
        sendSuccess(res, { orders: storeOrders });
    } catch (err) {
        sendError(res, 500, "Fetch orders failed", "DB_ERROR", err);
    }
});

// 4. Accept Order
app.post('/api/riders/:id/orders/:orderId/accept', verifyToken, async (req, res) => {
    try {
        const { id: riderId, orderId } = req.params;

        // Optimistic Locking / Transaction needed in real app
        // Check if still available
        const [check] = await db.execute('SELECT id FROM store_paid_orders WHERE id = ? AND rider_id IS NULL', [orderId]);
        if (check.length === 0) return sendError(res, 409, "Order already taken");

        await db.execute('UPDATE store_paid_orders SET rider_id = ?, status = ? WHERE id = ?', [riderId, 'assigned', orderId]);

        // Notify User/Merchant (Mock)
        console.log(`[Order #${orderId}] Accepted by Rider #${riderId}`);

        sendSuccess(res, null, "Order accepted");
    } catch (err) {
        sendError(res, 500, "Accept failed");
    }
});


// 5. Get Rider Wallet Balance
app.get('/api/riders/:id/wallet', verifyToken, async (req, res) => {
    try {
        const riderId = req.params.id;

        // Get rider's user_id first
        const [riderRows] = await db.execute('SELECT user_id FROM riders WHERE id = ?', [riderId]);
        if (riderRows.length === 0) return sendError(res, 404, "Rider not found");

        const userId = riderRows[0].user_id;

        // Get wallet balance
        const [walletRows] = await db.execute('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
        const balance = walletRows.length > 0 ? parseFloat(walletRows[0].balance) : 0;

        sendSuccess(res, { balance }, "Wallet balance retrieved");
    } catch (err) {
        console.error("Wallet fetch error:", err);
        sendError(res, 500, "Failed to fetch wallet", "DB_ERROR", err);
    }
});

// 6. Get Rider Earnings History
app.get('/api/riders/:id/earnings', verifyToken, async (req, res) => {
    try {
        const riderId = req.params.id;

        // Fetch completed orders assigned to this rider
        const [completedOrders] = await db.execute(`
            SELECT 
                o.id,
                o.total_amount,
                o.created_at,
                o.status,
                s.name as store_name
            FROM store_paid_orders o
            LEFT JOIN shops s ON o.store_id = s.id
            WHERE o.rider_id = ? AND o.status IN ('completed', 'delivered', 'assigned')
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [riderId]);

        // Calculate earnings summary
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        let todayEarnings = 0;
        let weekEarnings = 0;
        let totalEarnings = 0;

        // Assume rider fee is 10% of order total (or a flat fee, adjust as needed)
        const RIDER_FEE_PERCENT = 0.15; // 15%

        completedOrders.forEach(order => {
            const fee = parseFloat(order.total_amount) * RIDER_FEE_PERCENT;
            const orderDate = new Date(order.created_at);

            totalEarnings += fee;

            if (orderDate >= today) {
                todayEarnings += fee;
            }
            if (orderDate >= weekAgo) {
                weekEarnings += fee;
            }
        });

        sendSuccess(res, {
            summary: {
                today: todayEarnings.toFixed(2),
                week: weekEarnings.toFixed(2),
                total: totalEarnings.toFixed(2),
                deliveryCount: completedOrders.length
            },
            deliveries: completedOrders.map(o => ({
                id: o.id,
                storeName: o.store_name || 'Unknown Store',
                amount: (parseFloat(o.total_amount) * RIDER_FEE_PERCENT).toFixed(2),
                date: o.created_at,
                status: o.status
            }))
        }, "Earnings retrieved");
    } catch (err) {
        console.error("Earnings fetch error:", err);
        sendError(res, 500, "Failed to fetch earnings", "DB_ERROR", err);
    }
});


// ==========================================
// 🏪 MERCHANT API
// ==========================================
// Mount API Router for clean /api path handling
const apiRouter = express.Router();

apiRouter.post('/merchant/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const results = await db.query('SELECT * FROM merchants WHERE email = ?', [email]);

        if (results.length === 0) return sendError(res, 401, 'Invalid credentials');
        const merchant = results[0];

        const valid = await bcrypt.compare(password, merchant.password_hash);
        if (!valid) return sendError(res, 401, 'Invalid credentials');

        // Fetch the restaurant's current is_available status
        let isOnline = false;
        if (merchant.restaurant_id) {
            const [restRows] = await db.execute('SELECT is_available FROM restaurants WHERE id = ?', [merchant.restaurant_id]);
            if (restRows.length > 0) {
                isOnline = restRows[0].is_available === 1;
            }
        }

        const token = generateToken({ id: merchant.id, role: 'merchant', restaurantId: merchant.restaurant_id });
        sendSuccess(res, {
            id: merchant.id,
            name: merchant.name,
            email: merchant.email,
            phone_number: merchant.phone_number,
            restaurant_id: merchant.restaurant_id,
            is_online: isOnline,  // Include current online status from restaurants table
            accessToken: token
        });
    } catch (err) {
        sendError(res, 500, "Login failed", "AUTH_ERROR", err);
    }
});

apiRouter.post('/merchant/status', verifyToken, async (req, res) => {
    try {
        const { isOnline } = req.body;
        const restaurantId = req.user.restaurantId;

        // Updating 'is_available' in restaurants table as a proxy for "Online/Offline"
        await db.execute('UPDATE restaurants SET is_available = ? WHERE id = ?', [isOnline ? 1 : 0, restaurantId]);

        // If going ONLINE, notify all watchers and clear the list
        if (isOnline) {
            // Get restaurant name for notification
            const [restRows] = await db.execute('SELECT name FROM restaurants WHERE id = ?', [restaurantId]);
            const restaurantName = restRows.length > 0 ? restRows[0].name : 'Restaurant';

            // Fetch all watchers for this restaurant
            const [watchers] = await db.execute('SELECT user_id FROM restaurant_watchers WHERE restaurant_id = ?', [restaurantId]);

            if (watchers.length > 0) {
                console.log(`[Restaurant #${restaurantId}] Going online. Notifying ${watchers.length} watchers.`);

                // Emit notification to each watcher via Socket.IO
                watchers.forEach(watcher => {
                    io.emit(`user_${watcher.user_id}_restaurant_open`, {
                        restaurantId,
                        restaurantName,
                        message: `🎉 ${restaurantName} is now open!`
                    });
                });

                // Clear all watchers for this restaurant
                await db.execute('DELETE FROM restaurant_watchers WHERE restaurant_id = ?', [restaurantId]);
            }
        }

        sendSuccess(res, { isOnline }, "Status updated");
    } catch (err) {
        console.error("Status Update Failed", err);
        sendError(res, 500, "Update failed");
    }
});

apiRouter.get('/merchant/orders', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if ((role !== 'merchant' && role !== 'store_admin') || !restaurantId) return sendError(res, 403, 'Access denied');

        let orders = [];

        try {
            const storeQuery = `
                SELECT o.id, o.total_amount, o.status, o.created_at, 
                u.username as customer_name, 
                o.delivery_address,
                JSON_ARRAYAGG(
                    JSON_OBJECT('name', i.product_name, 'quantity', i.quantity, 'price', i.price)
                ) as items,
                o.rider_id,
                p.accepted_at,
                'store' as type
                FROM store_paid_orders o
                JOIN users u ON o.user_id = u.id
                JOIN store_order_items i ON o.id = i.order_id
                LEFT JOIN prepared_orders p ON o.id = p.order_id AND p.order_type = 'store'
                WHERE o.store_id = ?
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `;
            const [storeRows] = await db.query(storeQuery, [restaurantId]);
            if (storeRows.length > 0) {
                orders = storeRows.map(row => ({ ...row, items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items }));
            }
        } catch (ignore) { }

        // Fetch regular restaurant orders with accepted_at from prepared_orders
        const restQuery = `
            SELECT o.id, o.total_amount, o.status, o.created_at, o.dispatch_code,
            u.username as customer_name, 
            u.address as delivery_address, 
            JSON_ARRAYAGG(
                JSON_OBJECT('id', oi.id, 'name', m.name, 'quantity', oi.quantity, 'price', oi.price_at_time)
            ) as items,
            p.accepted_at
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            JOIN order_items oi ON o.id = oi.order_id 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            LEFT JOIN prepared_orders p ON o.id = p.order_id AND p.order_type = 'food'
            WHERE o.restaurant_id = ? 
            GROUP BY o.id 
            ORDER BY o.created_at DESC
        `;

        const restRows = await db.query(restQuery, [restaurantId]);

        const restOrders = Array.isArray(restRows) ? restRows.map(row => ({
            ...row,
            items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
            type: 'food'
        })) : [];

        sendSuccess(res, [...orders, ...restOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
});

apiRouter.post('/merchant/verify-rider', verifyToken, async (req, res) => {
    try {
        const { orderId, riderIdCode, orderType } = req.body;

        // Logic: Verify if the provided Rider Code matches the assigned rider 'id' or 'code'
        // For MVP: Rider's ID IS the code. 

        const table = orderType === 'store' ? 'store_paid_orders' : 'orders';

        const [rows] = await db.execute(`SELECT rider_id FROM ${table} WHERE id = ?`, [orderId]);
        if (rows.length === 0) return sendError(res, 404, "Order not found");

        const assignedRiderId = rows[0].rider_id;

        if (!assignedRiderId) return sendError(res, 400, "No rider assigned yet");

        if (parseInt(assignedRiderId) === parseInt(riderIdCode)) {
            // Success! Update status to 'delivering' (or handover complete)
            await db.execute(`UPDATE ${table} SET status = 'delivering' WHERE id = ?`, [orderId]);
            sendSuccess(res, { verified: true }, "Rider Verified. Order handed over.");
        } else {
            sendError(res, 401, "Invalid Rider ID. Verification failed.");
        }

        sendError(res, 500, "Verification Error");
    } catch (err) {
        console.error("Verify Rider Error:", err);
        sendError(res, 500, "Verification failed", "DB_ERROR", err);
    }
});

apiRouter.post('/merchant/orders/:id/status', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { status, type, reason } = req.body;

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const table = type === 'store' ? 'store_paid_orders' : 'orders';
        const storeCol = type === 'store' ? 'store_id' : 'restaurant_id';

        // Use execute for updates
        const [result] = await db.execute(`UPDATE ${table} SET status = ? WHERE id = ? AND ${storeCol} = ?`, [status, orderId, restaurantId]);

        if (result.affectedRows === 0) return sendError(res, 404, 'Order not found');

        // If status is 'cancelled' (decline), insert into declined_orders
        if (status === 'cancelled') {
            await db.execute('INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, ?, ?)', [orderId, type || 'food', reason || 'Order Declined']);
        }

        // If status is 'preparing' (accept), insert into prepared_orders and notify riders
        if (status === 'preparing') {
            await db.execute('INSERT INTO prepared_orders (order_id, order_type, restaurant_id) VALUES (?, ?, ?)', [orderId, type || 'food', restaurantId]);

            // Get restaurant location
            const [restaurantRows] = await db.execute('SELECT latitude, longitude, name FROM restaurants WHERE id = ?', [restaurantId]);

            if (restaurantRows.length > 0 && restaurantRows[0].latitude && restaurantRows[0].longitude) {
                const restLat = parseFloat(restaurantRows[0].latitude);
                const restLon = parseFloat(restaurantRows[0].longitude);
                const restName = restaurantRows[0].name;

                // Find online riders with location data
                const [onlineRiders] = await db.execute('SELECT id, user_id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

                // Calculate distance and sort
                const ridersWithDistance = onlineRiders.map(r => ({
                    ...r,
                    distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
                })).sort((a, b) => a.distance - b.distance);

                // Get 10 closest riders
                const closestRiders = ridersWithDistance.slice(0, 10);

                // Emit notification to each rider via Socket.IO
                closestRiders.forEach(rider => {
                    io.emit(`rider_${rider.id}_new_order`, {
                        orderId,
                        orderType: type || 'food',
                        restaurantId,
                        restaurantName: restName,
                        message: `New order ready for pickup at ${restName}!`,
                        distance: rider.distance.toFixed(2)
                    });
                });

                console.log(`[Order #${orderId}] Accepted. Notified ${closestRiders.length} closest riders.`);
            }
        }

        // If status is 'ready_for_pickup', auto-generate dispatch code if not already set
        if (status === 'ready_for_pickup' && type !== 'store') {
            // Check if order already has dispatch code
            const [orderCheck] = await db.execute('SELECT dispatch_code, total_amount FROM orders WHERE id = ?', [orderId]);

            if (orderCheck.length > 0 && !orderCheck[0].dispatch_code) {
                // Generate 6-digit dispatch code
                const dispatchCode = Math.floor(100000 + Math.random() * 900000).toString();

                // Save dispatch code to order
                await db.execute('UPDATE orders SET dispatch_code = ? WHERE id = ?', [dispatchCode, orderId]);

                // Get restaurant info for notification
                const [restaurantRows] = await db.execute('SELECT latitude, longitude, name, address FROM restaurants WHERE id = ?', [restaurantId]);

                if (restaurantRows.length > 0 && restaurantRows[0].latitude && restaurantRows[0].longitude) {
                    const restLat = parseFloat(restaurantRows[0].latitude);
                    const restLon = parseFloat(restaurantRows[0].longitude);
                    const restName = restaurantRows[0].name;
                    const restAddress = restaurantRows[0].address || '';
                    const totalAmount = orderCheck[0].total_amount;

                    // Find online riders
                    const [onlineRiders] = await db.execute('SELECT id, user_id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

                    // Calculate distance and sort using Haversine
                    const ridersWithDistance = onlineRiders.map(r => ({
                        ...r,
                        distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
                    })).sort((a, b) => a.distance - b.distance);

                    // Get 10 closest riders
                    const closestRiders = ridersWithDistance.slice(0, 10);

                    // Emit notification to each rider via Socket.IO with dispatch code
                    closestRiders.forEach(rider => {
                        io.emit(`rider_${rider.id}_new_order`, {
                            orderId,
                            orderType: type || 'food',
                            restaurantId,
                            restaurantName: restName,
                            restaurantAddress: restAddress,
                            totalAmount: parseFloat(totalAmount).toFixed(2),
                            dispatchCode,
                            message: `Pickup at ${restName} - ₱${parseFloat(totalAmount).toFixed(2)}`,
                            distance: rider.distance.toFixed(2)
                        });
                    });

                    // Also emit to general rider feed
                    io.emit('new_pickup', {
                        orderId,
                        restaurantName: restName,
                        restaurantAddress: restAddress,
                        totalAmount: parseFloat(totalAmount).toFixed(2),
                        dispatchCode,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`[Order #${orderId}] Marked Ready. Auto-generated Dispatch Code: ${dispatchCode}. Notified ${closestRiders.length} riders.`);
                }
            }
        }

        sendSuccess(res, { id: orderId, status }, 'Status updated');
    } catch (err) {
        console.error("Order status update error:", err);
        sendError(res, 500, 'Update failed');
    }
});

// Notify closest riders without changing order status - generates dispatch code
apiRouter.post('/merchant/orders/:id/notify-riders', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { type } = req.body;

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        // Get order details and check if dispatch code already exists
        const [orderRows] = await db.execute('SELECT total_amount, dispatch_code FROM orders WHERE id = ? AND restaurant_id = ?', [orderId, restaurantId]);
        if (orderRows.length === 0) return sendError(res, 404, 'Order not found');

        // If dispatch code already exists, return error - it's a one-time operation
        if (orderRows[0].dispatch_code) {
            return sendError(res, 400, 'Dispatch code already generated for this order');
        }

        // Generate 6-digit dispatch code (only if not already set)
        const dispatchCode = Math.floor(100000 + Math.random() * 900000).toString();

        const [restaurantRows] = await db.execute('SELECT latitude, longitude, name, address FROM restaurants WHERE id = ?', [restaurantId]);

        if (restaurantRows.length === 0 || !restaurantRows[0].latitude || !restaurantRows[0].longitude) {
            return sendError(res, 400, 'Restaurant location not set');
        }

        // Save dispatch code to order (permanent, one-time)
        await db.execute('UPDATE orders SET dispatch_code = ? WHERE id = ?', [dispatchCode, orderId]);

        const restLat = parseFloat(restaurantRows[0].latitude);
        const restLon = parseFloat(restaurantRows[0].longitude);
        const restName = restaurantRows[0].name;
        const restAddress = restaurantRows[0].address || '';
        const totalAmount = orderRows[0].total_amount;

        // Find online riders with location data
        const [onlineRiders] = await db.execute('SELECT id, user_id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

        if (onlineRiders.length === 0) {
            // Still save dispatch code even if no riders
            return sendSuccess(res, { dispatchCode, notifiedCount: 0 }, 'Dispatch code generated but no online riders available');
        }

        // Calculate distance and sort using Haversine
        const ridersWithDistance = onlineRiders.map(r => ({
            ...r,
            distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
        })).sort((a, b) => a.distance - b.distance);

        // Get 10 closest riders
        const closestRiders = ridersWithDistance.slice(0, 10);

        // Emit notification to each rider via Socket.IO with dispatch code
        closestRiders.forEach(rider => {
            io.emit(`rider_${rider.id}_new_order`, {
                orderId,
                orderType: type || 'food',
                restaurantId,
                restaurantName: restName,
                restaurantAddress: restAddress,
                totalAmount: parseFloat(totalAmount).toFixed(2),
                dispatchCode,
                message: `Pickup at ${restName} - ₱${parseFloat(totalAmount).toFixed(2)}`,
                distance: rider.distance.toFixed(2)
            });
        });

        // Also emit to general rider feed
        io.emit('new_pickup', {
            orderId,
            restaurantName: restName,
            restaurantAddress: restAddress,
            totalAmount: parseFloat(totalAmount).toFixed(2),
            dispatchCode,
            timestamp: new Date().toISOString()
        });

        console.log(`[Order #${orderId}] Dispatch Code: ${dispatchCode}. Notified ${closestRiders.length} closest riders.`);
        sendSuccess(res, {
            dispatchCode,
            notifiedCount: closestRiders.length,
            riders: closestRiders.map(r => ({ id: r.id, name: r.name, distance: r.distance.toFixed(2) }))
        }, 'Riders notified');

    } catch (err) {
        console.error("Notify riders error:", err);
        sendError(res, 500, 'Failed to notify riders');
    }
});

// Find orders by dispatch code for handoff
apiRouter.get('/merchant/orders/by-dispatch-code', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const { code } = req.query;

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');
        if (!code || code.length !== 6) return sendError(res, 400, 'Invalid dispatch code');

        const [orders] = await db.execute(`
            SELECT o.id, o.total_amount, o.status, o.dispatch_code, o.created_at,
                   u.username as customer_name, u.phone_number as customer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.restaurant_id = ? 
              AND o.dispatch_code = ?
              AND o.status IN ('preparing', 'ready_for_pickup')
        `, [restaurantId, code]);

        if (orders.length === 0) {
            return sendError(res, 404, 'No orders found with this dispatch code');
        }

        // Get items for each order
        for (let i = 0; i < orders.length; i++) {
            const [items] = await db.execute(`
                SELECT oi.quantity, m.name, oi.price_at_time
                FROM order_items oi
                JOIN menu_items m ON oi.menu_item_id = m.id
                WHERE oi.order_id = ?
            `, [orders[i].id]);
            orders[i].items = items;
        }

        const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

        sendSuccess(res, { orders, totalAmount: totalAmount.toFixed(2) }, 'Orders found');
    } catch (err) {
        console.error("Find by dispatch code error:", err);
        sendError(res, 500, 'Failed to find orders');
    }
});

// Release order to rider (mark as picked up)
apiRouter.post('/merchant/orders/:id/release', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { riderId } = req.body;

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        // Verify order belongs to restaurant and has dispatch code
        const [orderRows] = await db.execute(`
            SELECT o.id, o.user_id, o.dispatch_code, o.total_amount
            FROM orders o
            WHERE o.id = ? AND o.restaurant_id = ?
        `, [orderId, restaurantId]);

        if (orderRows.length === 0) return sendError(res, 404, 'Order not found');

        // Update order status to delivering
        await db.execute(`
            UPDATE orders 
            SET status = 'delivering', rider_id = ?, updated_at = NOW()
            WHERE id = ?
        `, [riderId || null, orderId]);

        // Clear dispatch code after release
        await db.execute('UPDATE orders SET dispatch_code = NULL WHERE id = ?', [orderId]);

        // Notify customer via Socket.IO
        const userId = orderRows[0].user_id;
        io.emit(`user_${userId}_order_update`, {
            orderId,
            status: 'delivering',
            message: 'Rider has picked up your order!'
        });

        console.log(`[Order #${orderId}] Released to rider. Customer notified.`);
        sendSuccess(res, { id: orderId, status: 'delivering' }, 'Order released to rider');

    } catch (err) {
        console.error("Release order error:", err);
        sendError(res, 500, 'Failed to release order');
    }
});

apiRouter.post('/merchant/orders/:id/process-batch', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { type, declinedItems, acceptedItems } = req.body;
        // acceptedItems is just an array of IDs kept (optional, we mainly strictly need declinedItems to remove)

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const orderTable = type === 'store' ? 'store_paid_orders' : 'orders';
        const itemTable = type === 'store' ? 'store_order_items' : 'order_items'; // store_order_items ID isPK? yes. order_items ID is PK? yes.
        const storeCol = type === 'store' ? 'store_id' : 'restaurant_id';

        // 1. Verify Order Ownership
        const [orderCheck] = await db.execute(`SELECT id, total_amount FROM ${orderTable} WHERE id = ? AND ${storeCol} = ?`, [orderId, restaurantId]);
        if (orderCheck.length === 0) return sendError(res, 404, 'Order not found');

        // 2. Process Declined Items

        if (declinedItems && declinedItems.length > 0) {
            for (const item of declinedItems) {
                // item: { id, name, price, quantity, reason }

                // A. Insert into declined_orders
                await db.execute(
                    `INSERT INTO declined_orders (order_id, order_type, item_name, quantity, reason) VALUES (?, ?, ?, ?, ?)`,
                    [orderId, type || 'food', item.name, item.quantity, item.reason]
                );

                // B. Remove from order_items table
                // NOTE: 'id' passed here must be the PRIMARY KEY of the item table (order_items.id), NOT the menu_item_id
                await db.execute(`DELETE FROM ${itemTable} WHERE id = ?`, [item.id]);
            }
        }

        // 3. Recalculate Total
        // Column name differs: food orders use 'price_at_time', store orders use 'price'
        const priceCol = type === 'store' ? 'price' : 'price_at_time';

        let newTotal = 0;
        const [remainingItems] = await db.execute(`SELECT quantity, ${priceCol} as price FROM ${itemTable} WHERE order_id = ?`, [orderId]);

        remainingItems.forEach(i => {
            newTotal += (parseFloat(i.price) * i.quantity);
        });

        // 4. Update Order
        // If no items remain, status should be 'cancelled' (or all declined)
        // Valid statuses: 'pending','preparing','delivering','delivered','cancelled'
        let newStatus = 'preparing';
        if (remainingItems.length === 0) {
            newStatus = 'cancelled';
        }

        await db.execute(`UPDATE ${orderTable} SET total_amount = ?, status = ? WHERE id = ?`, [newTotal, newStatus, orderId]);

        sendSuccess(res, { id: orderId, status: newStatus, newTotal, remainingCount: remainingItems.length }, "Order processed");

    } catch (err) {
        console.error("Batch Process Error", err);
        sendError(res, 500, "Processing failed", "DB_ERROR", err);
    }
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

apiRouter.get('/merchant/:id/menu', verifyToken, async (req, res) => {
    try {
        const results = await db.query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name', [req.user.restaurantId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
});

apiRouter.post('/merchant/menu/save', verifyToken, async (req, res) => {
    try {
        const { id, restaurant_id, name, description, price, cost, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end } = req.body;
        if (req.user.restaurantId !== restaurant_id) return sendError(res, 403, "Unauthorized");

        const sql = id
            ? `UPDATE menu_items SET name=?, description=?, price=?, cost=?, promotional_price=?, category=?, image_url=?, stock_quantity=?, is_available=?, food_type=?, cuisine_type=?, availability_start=?, availability_end=? WHERE id=? AND restaurant_id=?`
            : `INSERT INTO menu_items (name, description, price, cost, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = id
            ? [name, description, price, cost || 0, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, id, restaurant_id]
            : [name, description, price, cost || 0, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, restaurant_id];

        const result = await db.query(sql, params);
        sendSuccess(res, { id: id || result.insertId }, "Item saved");
    } catch (err) {
        sendError(res, 500, "Save failed", "DB_ERROR", err);
    }
});

apiRouter.delete('/merchant/menu/:itemId', verifyToken, async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const restaurantId = req.user.restaurantId;
        console.log(`[Delete Menu] Deleting item ${itemId} for restaurant ${restaurantId}`);
        await db.query('DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?', [itemId, restaurantId]);
        sendSuccess(res, null, "Item deleted");
    } catch (err) {
        console.error('[Delete Menu Error]', err);
        sendError(res, 500, "Delete failed", "DB_ERROR", err);
    }
});

// Sales History & Analytics - Get completed orders with profit calculations
apiRouter.get('/merchant/sales-history', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if (role !== 'merchant' || !restaurantId) return sendError(res, 403, 'Access denied');

        // Date filtering
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        const params = [restaurantId];

        if (startDate && endDate) {
            dateFilter = ' AND DATE(o.created_at) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = ' AND DATE(o.created_at) >= ?';
            params.push(startDate);
        } else if (endDate) {
            dateFilter = ' AND DATE(o.created_at) <= ?';
            params.push(endDate);
        }

        // Fetch completed/delivered orders for this restaurant
        const salesQuery = `
            SELECT 
                o.id as order_id,
                o.total_amount,
                o.status,
                o.created_at,
                u.username as customer_name,
                u.phone_number as customer_phone,
                r.name as rider_name,
                r.phone as rider_phone,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id', oi.id,
                        'name', m.name,
                        'quantity', oi.quantity,
                        'selling_price', oi.price_at_time,
                        'cost', COALESCE(oi.cost_at_time, m.cost, 0),
                        'promo_price', m.promotional_price
                    )
                ) as items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN riders r ON o.rider_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN menu_items m ON oi.menu_item_id = m.id
            WHERE o.restaurant_id = ? 
              AND o.status IN ('delivered', 'ready_for_pickup', 'completed')
              ${dateFilter}
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 1000
        `;

        const salesRows = await db.query(salesQuery, params);

        // Process and compute profit for each order
        const salesData = salesRows.map(row => {
            const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;

            // Calculate gross profit (selling price - cost) for each item
            let totalRevenue = 0;
            let totalCost = 0;

            const processedItems = items.map(item => {
                const itemRevenue = parseFloat(item.selling_price || 0) * (item.quantity || 1);
                const itemCost = parseFloat(item.cost || 0) * (item.quantity || 1);
                totalRevenue += itemRevenue;
                totalCost += itemCost;

                return {
                    ...item,
                    gross_profit: (itemRevenue - itemCost).toFixed(2)
                };
            });

            const grossProfit = totalRevenue - totalCost;
            // Net profit could include delivery fees, platform fees, etc. For now, same as gross
            const netProfit = grossProfit;

            return {
                order_id: row.order_id,
                order_number: `H-${row.order_id}`,
                timestamp: row.created_at,
                status: row.status,
                customer_name: row.customer_name,
                rider_name: row.rider_name || 'Not assigned',
                rider_phone: row.rider_phone || null,
                items: processedItems,
                total_revenue: totalRevenue.toFixed(2),
                total_cost: totalCost.toFixed(2),
                gross_profit: grossProfit.toFixed(2),
                net_profit: netProfit.toFixed(2),
                promo_applied: null // TODO: Add promo tracking when discount is applied to order
            };
        });

        // Calculate summary stats
        const summary = {
            total_orders: salesData.length,
            total_revenue: salesData.reduce((sum, s) => sum + parseFloat(s.total_revenue), 0).toFixed(2),
            total_cost: salesData.reduce((sum, s) => sum + parseFloat(s.total_cost), 0).toFixed(2),
            total_gross_profit: salesData.reduce((sum, s) => sum + parseFloat(s.gross_profit), 0).toFixed(2),
            total_net_profit: salesData.reduce((sum, s) => sum + parseFloat(s.net_profit), 0).toFixed(2)
        };

        sendSuccess(res, { sales: salesData, summary }, 'Sales history retrieved');
    } catch (err) {
        console.error('Sales history error:', err);
        sendError(res, 500, 'Failed to fetch sales history', 'DB_ERROR', err);
    }
});

// Image upload endpoint for menu items
apiRouter.post('/merchant/upload-image', verifyToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'No image file uploaded');
        }

        // Construct the public URL for the uploaded image
        const imageUrl = `/hungr/uploads/menu/${req.file.filename}`;

        console.log(`[Upload] Image uploaded: ${req.file.filename} for restaurant ${req.user.restaurantId}`);
        sendSuccess(res, { imageUrl }, 'Image uploaded successfully');
    } catch (err) {
        console.error('Upload error:', err);
        sendError(res, 500, 'Upload failed');
    }
});

apiRouter.get('/merchant/:id/discounts', verifyToken, async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const [existing] = await db.execute('SELECT id FROM store_discounts WHERE restaurant_id = ? AND is_system_default = 1', [restaurantId]);
        if (existing.length === 0) {
            await db.execute(`INSERT INTO store_discounts (restaurant_id, name, discount_type, value, is_active, is_system_default, requirements) VALUES (?, 'Senior Citizen', 'percentage', 20.00, 1, 1, 'Valid Senior Citizen ID'), (?, 'PWD', 'percentage', 20.00, 1, 1, 'Valid PWD ID')`, [restaurantId, restaurantId]);
        }
        const results = await db.query('SELECT * FROM store_discounts WHERE restaurant_id = ? ORDER BY is_system_default DESC, name ASC', [restaurantId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
});

apiRouter.post('/merchant/discounts/save', verifyToken, async (req, res) => {
    try {
        const { id, restaurant_id, name, discount_type, value, is_active, requirements } = req.body;
        if (req.user.restaurantId !== restaurant_id) return sendError(res, 403, "Unauthorized");
        const sql = id ? 'UPDATE store_discounts SET name=?, discount_type=?, value=?, is_active=?, requirements=? WHERE id=? AND restaurant_id=?' : 'INSERT INTO store_discounts (name, discount_type, value, is_active, requirements, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)';
        const params = id ? [name, discount_type, value, is_active, requirements, id, restaurant_id] : [name, discount_type, value, is_active, requirements, restaurant_id];

        const result = await db.query(sql, params);
        sendSuccess(res, { id: id || result.insertId });
    } catch (err) {
        sendError(res, 500, "Save failed");
    }
});

apiRouter.delete('/merchant/discounts/:id', verifyToken, async (req, res) => {
    try {
        await db.query('DELETE FROM store_discounts WHERE id = ? AND restaurant_id = ? AND is_system_default = 0', [req.params.id, req.user.restaurantId]);
        sendSuccess(res, null, "Discount deleted");
    } catch (err) {
        sendError(res, 500, "Delete failed");
    }
});

// Customer Auth
// Customer Addresses

apiRouter.get('/wallet', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // Check if table exists first (or catch error)
        try {
            const [rows] = await db.execute('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
            const balance = rows.length > 0 ? rows[0].balance : 0.00;
            sendSuccess(res, { balance });
        } catch (e) {
            // Table might not exist, return 0
            sendSuccess(res, { balance: 0.00 });
        }
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
});

apiRouter.get('/coins', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        try {
            const [rows] = await db.execute('SELECT balance FROM hungr_coins WHERE user_id = ?', [userId]);
            const coins = rows.length > 0 ? rows[0].balance : 0;
            sendSuccess(res, { coins });
        } catch (e) {
            sendSuccess(res, { coins: 0 });
        }
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
});

// Real Address Persistence
apiRouter.get('/users/addresses', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const results = await db.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
});

apiRouter.post('/users/addresses', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { label, address, latitude, longitude, is_default } = req.body;

        if (!label || !address) return sendError(res, 400, "Label and Address required");

        // Upsert: If label exists for user (e.g. "Home"), update it. uniqueness constrained by (user_id, label)
        const sql = `INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default) 
                         VALUES (?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE address = VALUES(address), latitude = VALUES(latitude), longitude = VALUES(longitude)`;

        const params = [userId, label, address, latitude || null, longitude || null, is_default ? 1 : 0];

        const result = await db.query(sql, params);

        sendSuccess(res, { id: result.insertId, label, address }, "Address saved");
    } catch (err) {
        sendError(res, 500, "Save failed", "DB_ERROR", err);
    }
});

apiRouter.delete('/users/addresses/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const addressId = req.params.id;

        // Security: Only delete if address belongs to user
        const result = await db.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);

        if (result.affectedRows === 0) return sendError(res, 404, "Address not found or unauthorized");

        sendSuccess(res, null, "Address deleted");
    } catch (err) {
        sendError(res, 500, "Delete failed", "DB_ERROR", err);
    }
});

apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const results = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            console.log(`[Login Failed] User not found: ${email}`);
            return sendError(res, 401, 'User not found');
        }
        const user = results[0];

        // DEBUG LOGGING
        console.log(`[Login Attempt] Email: '${email}'`);
        console.log(`[Login Attempt] Password Length: ${password.length}`);
        console.log(`[Login Attempt] Stored Hash: ${user.password_hash.substring(0, 10)}...`);

        const valid = await bcrypt.compare(password, user.password_hash);
        console.log(`[Login Attempt] Match Result: ${valid}`);

        if (!valid) return sendError(res, 401, 'Invalid password');

        const token = generateToken({ id: user.id, role: user.user_type });
        sendSuccess(res, { id: user.id, username: user.username, email: user.email, token, accessToken: token });
    } catch (err) {
        sendError(res, 500, "Login failed", "AUTH_ERROR", err);
    }
});

// PUBLIC: Get Restaurant Menu
apiRouter.get('/restaurants/:id/menu', async (req, res) => {
    try {
        const restaurantId = req.params.id;

        // Fetch restaurant details
        const [restaurantRows] = await db.execute('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
        if (restaurantRows.length === 0) return sendError(res, 404, 'Restaurant not found');
        const restaurant = restaurantRows[0];

        // Fetch menu items
        const menuItems = await db.query('SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY category, name', [restaurantId]);

        sendSuccess(res, { restaurant, menu: menuItems });
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
});

// Watch a closed restaurant - customer registers interest to be notified when it opens
apiRouter.post('/restaurants/:id/watch', verifyToken, async (req, res) => {
    try {
        const restaurantId = req.params.id;
        const userId = req.user.id;

        // Check if restaurant is actually closed
        const [restRows] = await db.execute('SELECT is_available, name FROM restaurants WHERE id = ?', [restaurantId]);
        if (restRows.length === 0) return sendError(res, 404, 'Restaurant not found');

        if (restRows[0].is_available === 1) {
            return sendSuccess(res, { watching: false }, 'Restaurant is already open');
        }

        // Add watcher (INSERT IGNORE handles duplicates)
        await db.execute(
            'INSERT IGNORE INTO restaurant_watchers (user_id, restaurant_id) VALUES (?, ?)',
            [userId, restaurantId]
        );

        console.log(`[Watch] User #${userId} is now watching Restaurant #${restaurantId} (${restRows[0].name})`);
        sendSuccess(res, { watching: true, restaurantName: restRows[0].name }, 'You will be notified when this restaurant opens');
    } catch (err) {
        console.error("Watch Error:", err);
        sendError(res, 500, 'Failed to watch restaurant');
    }
});
apiRouter.get('/restaurants', async (req, res) => {
    try {
        const results = await db.query('SELECT * FROM restaurants ORDER BY rating DESC');
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
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

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (SPA Fallback Active, Socket.io Ready)`);
});
