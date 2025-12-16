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
import { registerWalletRoutes } from './walletRoutes.js';

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

// ==========================================
// 🔌 SOCKET.IO CONNECTION HANDLER
// ==========================================
// Store active rider sockets for room management
const activeRiders = new Map(); // riderId -> socketId

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Rider goes online - join their dedicated room
    socket.on('rider_online', (data) => {
        const { riderId, latitude, longitude } = data;
        if (riderId) {
            socket.join(`rider_${riderId}`);
            activeRiders.set(riderId, socket.id);
            console.log(`[Socket] Rider #${riderId} joined room rider_${riderId}`);

            // Update rider location if provided
            if (latitude && longitude) {
                pool.promise().execute(
                    'UPDATE riders SET current_latitude = ?, current_longitude = ?, is_online = 1 WHERE id = ?',
                    [latitude, longitude, riderId]
                ).catch(err => console.error('Failed to update rider location:', err));
            }
        }
    });

    // Rider goes offline
    socket.on('rider_offline', (data) => {
        const { riderId } = data;
        if (riderId) {
            socket.leave(`rider_${riderId}`);
            activeRiders.delete(riderId);
            console.log(`[Socket] Rider #${riderId} left room`);
        }
    });

    // Rider location update
    socket.on('rider_location_update', async (data) => {
        const { riderId, latitude, longitude } = data;
        if (riderId && latitude && longitude) {
            try {
                await pool.promise().execute(
                    'UPDATE riders SET current_latitude = ?, current_longitude = ?, last_location_update = NOW() WHERE id = ?',
                    [latitude, longitude, riderId]
                );
            } catch (err) {
                console.error('Failed to update rider location:', err);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        // Remove from activeRiders map
        for (const [riderId, socketId] of activeRiders.entries()) {
            if (socketId === socket.id) {
                activeRiders.delete(riderId);
                break;
            }
        }
    });
});

// Helper function to notify closest riders via Socket.io
async function notifyClosestRiders(orderData, pickupLat, pickupLng, maxRiders = 10, maxDistanceKm = 10) {
    try {
        const [onlineRiders] = await pool.promise().execute(
            'SELECT id, name, current_latitude as latitude, current_longitude as longitude FROM riders WHERE is_online = 1'
        );

        // Calculate distances using Haversine
        const ridersWithDistance = onlineRiders
            .filter(r => r.latitude && r.longitude)
            .map(r => ({
                ...r,
                distance: haversineDistance(pickupLat, pickupLng, r.latitude, r.longitude)
            }))
            .filter(r => r.distance <= maxDistanceKm)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, maxRiders);

        console.log(`[Notify] Found ${ridersWithDistance.length} riders within ${maxDistanceKm}km`);

        // Emit to each rider's dedicated room
        ridersWithDistance.forEach(rider => {
            io.to(`rider_${rider.id}`).emit('new_order', {
                ...orderData,
                estimatedDistance: rider.distance.toFixed(2),
                expiresAt: Date.now() + 30000 // 30 seconds to accept
            });
            console.log(`[Notify] Sent order to Rider #${rider.id} (${rider.distance.toFixed(2)}km away)`);
        });

        return ridersWithDistance;
    } catch (err) {
        console.error('Failed to notify riders:', err);
        return [];
    }
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

// Serve admin wallet page
app.get('/hungr/admin-wallet.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-wallet.html'));
});
app.get('/admin-wallet', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-wallet.html'));
});

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

        // Add premium subscription columns to restaurants
        try {
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_premium TINYINT(1) DEFAULT 0
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_expires_at DATETIME DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_banner_image VARCHAR(255) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_tagline VARCHAR(100) DEFAULT NULL
            `);
            console.log("restaurants premium columns checked/added.");
        } catch (e) {
            console.log("restaurants premium columns might already exist.");
        }

        // Add location columns to restaurants (for Haversine rider dispatch)
        try {
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL
            `);
            console.log("restaurants location columns checked/added.");
        } catch (e) {
            console.log("restaurants location columns might already exist.");
        }

        // Add location columns to merchants (linked to restaurants)
        try {
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL
            `);
            console.log("merchants location columns checked/added.");
        } catch (e) {
            console.log("merchants location columns might already exist.");
        }

        // Add location columns to stores (for Pabili/Store orders)
        try {
            await poolPromise.execute(`
                ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            console.log("stores location columns checked/added.");
        } catch (e) {
            console.log("stores location columns might already exist.");
        }

        // Add rider_id to orders table (for rider assignment)
        try {
            await poolPromise.execute(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_id INT DEFAULT NULL
            `);
            console.log("orders.rider_id column checked/added.");
        } catch (e) {
            console.log("orders.rider_id column might already exist.");
        }

        // Add last_location_update to riders table
        try {
            await poolPromise.execute(`
                ALTER TABLE riders ADD COLUMN IF NOT EXISTS last_location_update DATETIME DEFAULT NULL
            `);
            console.log("riders.last_location_update column checked/added.");
        } catch (e) {
            console.log("riders.last_location_update column might already exist.");
        }

        // Add location columns to users table (for customer delivery location)
        try {
            await poolPromise.execute(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            console.log("users location columns checked/added.");
        } catch (e) {
            console.log("users location columns might already exist.");
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

// Get customer order history
app.get('/api/orders/history', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get food orders from 'orders' table
        const [foodOrders] = await db.execute(`
            SELECT 
                o.id,
                o.total_amount as amount,
                o.status,
                o.created_at,
                r.name as merchant_name,
                'food' as type
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [userId]);

        // Get store orders from 'store_paid_orders' table
        const [storeOrders] = await db.execute(`
            SELECT 
                o.id,
                o.total_amount as amount,
                o.status,
                o.created_at,
                s.name as merchant_name,
                'store' as type
            FROM store_paid_orders o
            LEFT JOIN stores s ON o.store_id = s.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [userId]);

        // Combine and sort by date (newest first)
        const allOrders = [...foodOrders, ...storeOrders]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);

        sendSuccess(res, allOrders);
    } catch (err) {
        console.error('Order history error:', err);
        sendError(res, 500, 'Failed to fetch order history');
    }
});

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

            // Emit socket event ONLY to merchant (not riders!) so merchant dashboard can display it
            io.to(`merchant_${storeId}`).emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                type: 'store',
                customer_name: 'New Customer',
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

            // Emit socket event ONLY to merchant (not riders!) so merchant dashboard can display it
            io.to(`merchant_${restaurantId}`).emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                type: 'food',
                customer_name: 'Customer',
                created_at: new Date(),
                restaurant_id: restaurantId,
                items: items || [],
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
        const { isOnline, latitude, longitude } = req.body;
        if (latitude && longitude) {
            await db.execute('UPDATE riders SET is_online = ?, current_latitude = ?, current_longitude = ? WHERE id = ?',
                [isOnline ? 1 : 0, latitude, longitude, req.params.id]);
        } else {
            await db.execute('UPDATE riders SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, req.params.id]);
        }
        sendSuccess(res, { isOnline }, "Status updated");
    } catch (err) {
        sendError(res, 500, "Update failed");
    }
});

// 2b. Update Rider Location (called every 10 seconds when online)
app.patch('/api/riders/:id/location', verifyToken, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) {
            return sendError(res, 400, "Latitude and longitude required");
        }
        await db.execute(
            'UPDATE riders SET current_latitude = ?, current_longitude = ?, last_location_update = NOW() WHERE id = ?',
            [latitude, longitude, req.params.id]
        );
        sendSuccess(res, { latitude, longitude }, "Location updated");
    } catch (err) {
        sendError(res, 500, "Location update failed", "DB_ERROR", err);
    }
});

// 3. Get Available Orders (includes both Store and Food orders)
// Supports proximity filtering via query params: ?lat=X&lng=Y&maxDistance=5
app.get('/api/riders/:id/orders', verifyToken, async (req, res) => {
    try {
        const riderId = req.params.id;
        const { lat, lng, maxDistance = 10 } = req.query;

        // Fetch Store Paid Orders that are 'paid' (ready for pickup) and rider_id is NULL
        const storeOrders = await db.query(`
            SELECT o.id, o.total_amount as fee, s.name as title, s.address as pickup_location, 
                   s.latitude as pickup_lat, s.longitude as pickup_lng, 'store' as order_type,
                   o.created_at
            FROM store_paid_orders o
            JOIN stores s ON o.store_id = s.id
            WHERE o.status = 'paid' AND o.rider_id IS NULL
            ORDER BY o.created_at DESC
        `);

        // Fetch Food Orders that have dispatch_code (merchant notified riders) - includes preparing AND ready
        const foodOrders = await db.query(`
            SELECT o.id, o.total_amount as fee, r.name as title, r.address as pickup_location,
                   r.latitude as pickup_lat, r.longitude as pickup_lng, 'food' as order_type,
                   o.created_at, o.dispatch_code, o.status
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.status IN ('preparing', 'ready_for_pickup') AND o.rider_id IS NULL AND o.dispatch_code IS NOT NULL
            ORDER BY o.created_at DESC
        `);

        // Combine all orders
        let allOrders = [...storeOrders, ...foodOrders];

        // Apply proximity filtering if rider location provided
        if (lat && lng) {
            const riderLat = parseFloat(lat);
            const riderLng = parseFloat(lng);
            const maxDist = parseFloat(maxDistance);

            allOrders = allOrders
                .filter(o => o.pickup_lat && o.pickup_lng)
                .map(o => ({
                    ...o,
                    distance: haversineDistance(riderLat, riderLng, o.pickup_lat, o.pickup_lng)
                }))
                .filter(o => o.distance <= maxDist)
                .sort((a, b) => a.distance - b.distance);
        }

        // Sort by newest first if no distance filtering
        if (!lat || !lng) {
            allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        sendSuccess(res, { orders: allOrders });
    } catch (err) {
        sendError(res, 500, "Fetch orders failed", "DB_ERROR", err);
    }
});

// 4. Accept Order (handles both food and store orders)
app.post('/api/riders/:id/orders/:orderId/accept', verifyToken, async (req, res) => {
    try {
        const { id: riderId, orderId } = req.params;
        const { orderType = 'store' } = req.body; // 'food' or 'store'

        // Get rider info
        const [riderRows] = await db.execute('SELECT id, name, current_latitude, current_longitude FROM riders WHERE id = ?', [riderId]);
        if (riderRows.length === 0) return sendError(res, 404, "Rider not found");

        const rider = riderRows[0];
        let restaurantId, restaurantName, restaurantLat, restaurantLng, restaurantAddress;

        let dispatchCode = null;

        if (orderType === 'food') {
            // Handle food order - also fetch dispatch_code
            const [check] = await db.execute('SELECT o.id, o.restaurant_id, o.dispatch_code, r.name, r.latitude, r.longitude, r.address FROM orders o JOIN restaurants r ON o.restaurant_id = r.id WHERE o.id = ? AND o.rider_id IS NULL', [orderId]);
            if (check.length === 0) return sendError(res, 409, "Order already taken or not found");

            restaurantId = check[0].restaurant_id;
            restaurantName = check[0].name;
            restaurantLat = parseFloat(check[0].latitude);
            restaurantLng = parseFloat(check[0].longitude);
            restaurantAddress = check[0].address || '';
            dispatchCode = check[0].dispatch_code;

            // Update order with rider assignment - keep status as 'preparing', only assign rider
            await db.execute('UPDATE orders SET rider_id = ? WHERE id = ?', [riderId, orderId]);
        } else {
            // Handle store order
            const [check] = await db.execute('SELECT o.id, o.store_id, s.name, s.latitude, s.longitude, s.address FROM store_paid_orders o JOIN stores s ON o.store_id = s.id WHERE o.id = ? AND o.rider_id IS NULL', [orderId]);
            if (check.length === 0) return sendError(res, 409, "Order already taken or not found");

            restaurantId = check[0].store_id;
            restaurantName = check[0].name;
            restaurantLat = parseFloat(check[0].latitude || 0);
            restaurantLng = parseFloat(check[0].longitude || 0);
            restaurantAddress = check[0].address || '';

            await db.execute('UPDATE store_paid_orders SET rider_id = ?, status = ? WHERE id = ?', [riderId, 'assigned', orderId]);
        }

        // Calculate ETA based on distance (assume 20km/h average speed for motorcycle in city)
        let etaMinutes = 10; // default
        let distance = 0;
        if (rider.current_latitude && rider.current_longitude && restaurantLat && restaurantLng) {
            distance = haversineDistance(
                rider.current_latitude, rider.current_longitude,
                restaurantLat, restaurantLng
            );
            // 20km/h = 0.33 km/min, so time = distance / 0.33
            etaMinutes = Math.ceil(distance / 0.33);
            if (etaMinutes < 2) etaMinutes = 2; // minimum 2 minutes
            if (etaMinutes > 60) etaMinutes = 60; // cap at 60 minutes
        }

        const etaArrival = new Date(Date.now() + etaMinutes * 60 * 1000);

        // Notify merchant via Socket.IO
        io.emit(`merchant_${restaurantId}_rider_accepted`, {
            orderId: parseInt(orderId),
            orderType,
            riderId: parseInt(riderId),
            riderName: rider.name,
            eta: etaMinutes,
            etaArrival: etaArrival.toISOString(),
            distance: distance.toFixed(2),
            message: `${rider.name} is on the way! ETA: ${etaMinutes} min`
        });

        console.log(`[Order #${orderId}] Accepted by Rider #${riderId} (${rider.name}). ETA: ${etaMinutes} min, Distance: ${distance.toFixed(2)}km`);

        sendSuccess(res, {
            orderId: parseInt(orderId),
            riderId: parseInt(riderId),
            eta: etaMinutes,
            etaArrival: etaArrival.toISOString(),
            distance: distance.toFixed(2),
            dispatchCode: dispatchCode,
            pickup: {
                name: restaurantName,
                address: restaurantAddress,
                latitude: restaurantLat,
                longitude: restaurantLng
            }
        }, "Order accepted! Navigate to pickup location.");
    } catch (err) {
        console.error("Accept order error:", err);
        sendError(res, 500, "Accept failed", "DB_ERROR", err);
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

// 5b. Mark Delivery as Complete
app.post('/api/riders/:id/orders/:orderId/complete', verifyToken, async (req, res) => {
    try {
        const { id: riderId, orderId } = req.params;
        const { orderType } = req.body; // 'food' or 'store'

        if (orderType === 'food' || !orderType) {
            // Update food order to completed
            const [result] = await db.execute(
                'UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ? AND rider_id = ?',
                ['delivered', orderId, riderId]
            );

            if (result.affectedRows === 0) {
                return sendError(res, 404, 'Order not found or not assigned to you');
            }

            // Notify customer via Socket.IO
            const [orderRows] = await db.execute('SELECT user_id FROM orders WHERE id = ?', [orderId]);
            if (orderRows.length > 0) {
                io.emit('order_completed', {
                    orderId,
                    userId: orderRows[0].user_id,
                    message: 'Your order has been delivered!'
                });
            }
        } else {
            // Update store order to completed
            const [result] = await db.execute(
                'UPDATE store_paid_orders SET status = ?, completed_at = NOW() WHERE id = ? AND rider_id = ?',
                ['delivered', orderId, riderId]
            );

            if (result.affectedRows === 0) {
                return sendError(res, 404, 'Order not found or not assigned to you');
            }
        }

        console.log(`[Order #${orderId}] Delivery completed by Rider #${riderId}`);
        sendSuccess(res, { orderId, status: 'completed' }, 'Delivery marked as complete');
    } catch (err) {
        console.error('Complete delivery error:', err);
        sendError(res, 500, 'Failed to complete delivery');
    }
});

// 6. Get Rider Earnings History
app.get('/api/riders/:id/earnings', verifyToken, async (req, res) => {
    try {
        const riderId = req.params.id;

        // Fetch completed/cancelled orders assigned to this rider (both food and store orders)
        // Excludes 'delivering' status as those are still active
        const [completedOrders] = await db.execute(`
            (SELECT 
                o.id,
                o.total_amount,
                o.created_at,
                o.status,
                r.name as store_name,
                'food' as order_type
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.rider_id = ? AND o.status IN ('completed', 'delivered', 'cancelled'))
            UNION ALL
            (SELECT 
                o.id,
                o.total_amount,
                o.created_at,
                o.status,
                s.name as store_name,
                'store' as order_type
            FROM store_paid_orders o
            LEFT JOIN stores s ON o.store_id = s.id
            WHERE o.rider_id = ? AND o.status IN ('completed', 'delivered', 'cancelled'))
            ORDER BY created_at DESC
            LIMIT 50
        `, [riderId, riderId]);

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

// Update Merchant Location (for Haversine rider dispatch)
apiRouter.patch('/merchant/location', verifyToken, async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        const restaurantId = req.user.restaurantId;
        const merchantId = req.user.merchantId;

        if (!latitude || !longitude) {
            return sendError(res, 400, "Latitude and longitude are required");
        }

        // Update restaurant location
        await db.execute(
            'UPDATE restaurants SET latitude = ?, longitude = ?, address = ? WHERE id = ?',
            [latitude, longitude, address || null, restaurantId]
        );

        // Update merchant location if merchantId exists
        if (merchantId) {
            await db.execute(
                'UPDATE merchants SET latitude = ?, longitude = ?, address = ? WHERE id = ?',
                [latitude, longitude, address || null, merchantId]
            );
        }

        console.log(`[Merchant] Restaurant #${restaurantId} location updated: ${latitude}, ${longitude}`);
        sendSuccess(res, { latitude, longitude, address }, "Location updated successfully");
    } catch (err) {
        console.error("Merchant location update error:", err);
        sendError(res, 500, 'Failed to update location', 'DB_ERROR', err);
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
            SELECT o.id, o.total_amount, o.status, o.created_at, o.dispatch_code, o.rider_id,
            u.username as customer_name, 
            u.address as delivery_address, 
            JSON_ARRAYAGG(
                JSON_OBJECT('id', oi.id, 'name', m.name, 'quantity', oi.quantity, 'price', oi.price_at_time)
            ) as items,
            p.accepted_at,
            r.name as rider_name
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            JOIN order_items oi ON o.id = oi.order_id 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            LEFT JOIN prepared_orders p ON o.id = p.order_id AND p.order_type = 'food'
            LEFT JOIN riders r ON o.rider_id = r.id
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

// Get nearby riders for merchant dashboard monitor
apiRouter.get('/merchant/nearby-riders', verifyToken, async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if (role !== 'merchant' || !restaurantId) return sendError(res, 403, 'Access denied');

        // Get restaurant location
        const [restaurantRows] = await db.execute('SELECT latitude, longitude FROM restaurants WHERE id = ?', [restaurantId]);
        if (restaurantRows.length === 0 || !restaurantRows[0].latitude || !restaurantRows[0].longitude) {
            return sendSuccess(res, {
                within5km: { count: 0, riders: [] },
                within10km: { count: 0, riders: [] },
                message: 'Restaurant location not set'
            });
        }

        const restLat = parseFloat(restaurantRows[0].latitude);
        const restLon = parseFloat(restaurantRows[0].longitude);

        // Get all online riders with location
        const [onlineRiders] = await db.execute(
            'SELECT id, name, vehicle_type, current_latitude, current_longitude, last_location_update FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL'
        );

        // Calculate distance for each rider
        const ridersWithDistance = onlineRiders.map(r => ({
            id: r.id,
            name: r.name,
            vehicleType: r.vehicle_type,
            distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude)),
            lastUpdate: r.last_location_update
        })).sort((a, b) => a.distance - b.distance);

        // Group by radius
        const within5km = ridersWithDistance.filter(r => r.distance <= 5);
        const within10km = ridersWithDistance.filter(r => r.distance <= 10 && r.distance > 5);

        sendSuccess(res, {
            within5km: {
                count: within5km.length,
                riders: within5km.map(r => ({
                    id: r.id,
                    name: r.name,
                    vehicle: r.vehicleType,
                    distance: r.distance.toFixed(1) + ' km'
                }))
            },
            within10km: {
                count: within10km.length,
                riders: within10km.map(r => ({
                    id: r.id,
                    name: r.name,
                    vehicle: r.vehicleType,
                    distance: r.distance.toFixed(1) + ' km'
                }))
            },
            totalOnline: onlineRiders.length
        });
    } catch (err) {
        console.error('Nearby riders error:', err);
        sendError(res, 500, 'Failed to fetch nearby riders');
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
                        // New: Emit to rider's dedicated room (industry standard)
                        io.to(`rider_${rider.id}`).emit('new_order', {
                            orderId,
                            orderType: type || 'food',
                            restaurantId,
                            restaurantName: restName,
                            restaurantAddress: restAddress,
                            totalAmount: parseFloat(totalAmount).toFixed(2),
                            dispatchCode,
                            message: `Pickup at ${restName} - ₱${parseFloat(totalAmount).toFixed(2)}`,
                            estimatedDistance: rider.distance.toFixed(2),
                            expiresAt: Date.now() + 30000 // 30 seconds to accept
                        });

                        // Legacy: Also emit to rider-specific event
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

// Tiered notification radius configuration (km)
const NOTIFICATION_RADIUS_TIERS = [5, 10, 20];
const NOTIFICATION_EXPANSION_MINUTES = 2; // Minutes before expanding to next tier

// Notify closest riders without changing order status - generates dispatch code
// Uses tiered system: starts at 5km, expands to 10km after 2 min, then 20km
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

        const initialRadius = NOTIFICATION_RADIUS_TIERS[0]; // Start with 5km

        // Save dispatch code and notification state to order
        await db.execute(
            'UPDATE orders SET dispatch_code = ?, notification_radius = ?, notification_started_at = NOW() WHERE id = ?',
            [dispatchCode, initialRadius, orderId]
        );

        const restLat = parseFloat(restaurantRows[0].latitude);
        const restLon = parseFloat(restaurantRows[0].longitude);
        const restName = restaurantRows[0].name;
        const restAddress = restaurantRows[0].address || '';
        const totalAmount = orderRows[0].total_amount;

        // Find online riders with location data
        const [onlineRiders] = await db.execute('SELECT id, user_id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

        if (onlineRiders.length === 0) {
            return sendSuccess(res, { dispatchCode, notifiedCount: 0, radius: initialRadius }, 'Dispatch code generated but no online riders available');
        }

        // Calculate distance and sort using Haversine
        const ridersWithDistance = onlineRiders.map(r => ({
            ...r,
            distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
        })).sort((a, b) => a.distance - b.distance);

        // TIERED: Only notify riders within initial radius (5km)
        const closestRiders = ridersWithDistance
            .filter(r => r.distance <= initialRadius)
            .slice(0, 10);

        // Emit notification to each rider via Socket.IO
        closestRiders.forEach(rider => {
            io.to(`rider_${rider.id}`).emit('new_order', {
                orderId,
                orderType: type || 'food',
                restaurantId,
                restaurantName: restName,
                restaurantAddress: restAddress,
                totalAmount: parseFloat(totalAmount).toFixed(2),
                message: `Pickup at ${restName} - ₱${parseFloat(totalAmount).toFixed(2)}`,
                estimatedDistance: rider.distance.toFixed(2)
            });
            console.log(`[Order #${orderId}] Tier 1 (${initialRadius}km): Notified Rider #${rider.id} (${rider.name}) - ${rider.distance.toFixed(2)}km away`);
        });

        console.log(`[Order #${orderId}] Dispatch Code: ${dispatchCode}. Tier 1 (${initialRadius}km): Notified ${closestRiders.length} riders.`);

        // If no riders within initial radius, log that expansion will occur
        if (closestRiders.length === 0) {
            console.log(`[Order #${orderId}] No riders within ${initialRadius}km. Will expand to ${NOTIFICATION_RADIUS_TIERS[1]}km in ${NOTIFICATION_EXPANSION_MINUTES} minutes.`);
        }

        sendSuccess(res, {
            dispatchCode,
            notifiedCount: closestRiders.length,
            radius: initialRadius,
            riders: closestRiders.map(r => ({ id: r.id, name: r.name, distance: r.distance.toFixed(2) }))
        }, closestRiders.length > 0 ? 'Riders notified' : `No riders within ${initialRadius}km - will expand automatically`);

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
            SELECT o.id, o.total_amount, o.status, o.dispatch_code, o.created_at, o.rider_id,
                   u.username as customer_name, u.phone_number as customer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.restaurant_id = ? 
              AND o.dispatch_code = ?
              AND o.status IN ('preparing', 'ready_for_pickup', 'delivering')
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

        // Verify order belongs to restaurant and get customer info
        const [orderRows] = await db.execute(`
            SELECT o.id, o.user_id, o.dispatch_code, o.total_amount, o.rider_id,
                   u.username as customer_name, u.phone_number as customer_phone,
                   u.address as customer_address, u.latitude as customer_lat, u.longitude as customer_lng
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ? AND o.restaurant_id = ?
        `, [orderId, restaurantId]);

        if (orderRows.length === 0) return sendError(res, 404, 'Order not found');

        const order = orderRows[0];
        const effectiveRiderId = riderId || order.rider_id;

        // Update order status to delivering
        await db.execute(`
            UPDATE orders 
            SET status = 'delivering', updated_at = NOW()
            WHERE id = ?
        `, [orderId]);

        // Clear dispatch code after release
        await db.execute('UPDATE orders SET dispatch_code = NULL WHERE id = ?', [orderId]);

        // Notify customer via Socket.IO
        io.emit(`user_${order.user_id}_order_update`, {
            orderId,
            status: 'delivering',
            message: 'Rider has picked up your order!'
        });

        // Notify rider with delivery destination
        const deliveryData = {
            orderId: parseInt(orderId),
            status: 'delivering',
            delivery: {
                name: order.customer_name,
                phone: order.customer_phone,
                address: order.customer_address || 'Address not available',
                latitude: order.customer_lat ? parseFloat(order.customer_lat) : null,
                longitude: order.customer_lng ? parseFloat(order.customer_lng) : null
            },
            message: 'Order picked up! Navigate to customer.'
        };

        if (effectiveRiderId) {
            const targetRoom = `rider_${effectiveRiderId}`;
            const roomSockets = io.sockets.adapter.rooms.get(targetRoom);
            const socketsInRoom = roomSockets ? roomSockets.size : 0;
            console.log(`[Order #${orderId}] Emitting order_released to room '${targetRoom}'. Sockets in room: ${socketsInRoom}`);
            console.log(`[Order #${orderId}] Active riders map:`, [...activeRiders.entries()]);
            io.to(targetRoom).emit('order_released', deliveryData);
            console.log(`[Order #${orderId}] Released. Rider #${effectiveRiderId} notified via room.`);
        } else {
            // Fallback: broadcast to all clients (rider should filter by orderId)
            io.emit('order_released', deliveryData);
            console.log(`[Order #${orderId}] Released. No rider_id found, broadcasting to all.`);
        }

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

        // Get coin balance
        const [balanceRows] = await db.execute('SELECT balance FROM hungr_coins WHERE user_id = ?', [userId]);
        const balance = balanceRows.length > 0 ? parseFloat(balanceRows[0].balance) : 0;

        // Get coin transaction history
        let transactions = [];
        try {
            const [txRows] = await db.execute(`
                SELECT id, user_id, amount, entry_type, transaction_type, description, reference_id, created_at
                FROM coin_transactions
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 20
            `, [userId]);
            transactions = txRows;
        } catch (e) {
            // Table might not exist yet
            console.log('coin_transactions table may not exist:', e.message);
        }

        sendSuccess(res, { balance, transactions });
    } catch (err) {
        console.error('Coins fetch error:', err);
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

// Update user GPS location (for delivery location)
apiRouter.patch('/users/location', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude, address } = req.body;

        if (!latitude || !longitude) {
            return sendError(res, 400, "Latitude and longitude are required");
        }

        // Update user's location in users table
        await db.execute(
            'UPDATE users SET latitude = ?, longitude = ?, address = ? WHERE id = ?',
            [latitude, longitude, address || null, userId]
        );

        console.log(`[User] User #${userId} location updated: ${latitude}, ${longitude}`);
        sendSuccess(res, { latitude, longitude, address }, "Location updated successfully");
    } catch (err) {
        sendError(res, 500, "Failed to update location", "DB_ERROR", err);
    }
});

// Get user location
apiRouter.get('/users/location', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.execute(
            'SELECT latitude, longitude, address FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return sendError(res, 404, "User not found");
        }

        sendSuccess(res, rows[0]);
    } catch (err) {
        sendError(res, 500, "Failed to fetch location", "DB_ERROR", err);
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

// Get Premium Restaurants (for customer app banner carousel)
apiRouter.get('/restaurants/premium', async (req, res) => {
    try {
        // Get restaurants where is_premium = 1 AND premium_expires_at is in the future
        const results = await db.query(`
            SELECT id, name, cuisine_type, image_url, rating, delivery_time_min, delivery_time_max,
                   premium_banner_image, premium_tagline
            FROM restaurants 
            WHERE is_premium = 1 
              AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
            ORDER BY rating DESC
            LIMIT 10
        `);

        // Transform results for banner display
        const banners = results.map(r => ({
            id: r.id,
            restaurantId: r.id,
            title: r.premium_tagline || r.name,
            subtitle: r.cuisine_type ? `Best ${r.cuisine_type} in town!` : 'Order Now!',
            description: `⭐ ${r.rating} rating • ${r.delivery_time_min}-${r.delivery_time_max} min delivery`,
            image: r.premium_banner_image || r.image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
            restaurantName: r.name,
            cta: 'Order Now'
        }));

        sendSuccess(res, banners);
    } catch (err) {
        console.error("Premium restaurants fetch error:", err);
        sendError(res, 500, 'Failed to fetch premium restaurants');
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
// Register wallet API routes
registerWalletRoutes(apiRouter, db, verifyToken, sendSuccess, sendError, io);

app.use('/api', apiRouter);
app.use('/hungr/api', apiRouter); // Support subpath API calls
app.use('/hungrriders/api', apiRouter); // Support rider app API calls


// --- SPA CATCH-ALL (Fixes 404s) ---
app.get('*', (req, res) => {
    // If it starts with /api or /hungr/api or /hungrriders/api, it's a real 404 from the API
    if (req.url.startsWith('/api/') || req.url.startsWith('/hungr/api/') || req.url.startsWith('/hungrriders/api/')) {
        return sendError(res, 404, 'API Endpoint not found');
    }
    // Otherwise, it's a frontend route (like /login or /hungr/login), so serve index.html
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- TIERED NOTIFICATION EXPANSION JOB ---
// Runs every 60 seconds to expand notification radius for orders without riders
setInterval(async () => {
    try {
        // Find orders that have notification_started_at set but no rider_id
        // and are still in 'preparing' or 'ready_for_pickup' status
        const [ordersNeedingExpansion] = await db.execute(`
            SELECT o.id, o.restaurant_id, o.total_amount, o.notification_radius, o.notification_started_at,
                   r.latitude, r.longitude, r.name as restaurant_name, r.address as restaurant_address
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.rider_id IS NULL 
              AND o.dispatch_code IS NOT NULL
              AND o.notification_started_at IS NOT NULL
              AND o.status IN ('preparing', 'ready_for_pickup')
              AND TIMESTAMPDIFF(MINUTE, o.notification_started_at, NOW()) >= ?
              AND o.notification_radius < ?
        `, [NOTIFICATION_EXPANSION_MINUTES, Math.max(...NOTIFICATION_RADIUS_TIERS)]);

        for (const order of ordersNeedingExpansion) {
            const currentRadius = order.notification_radius || NOTIFICATION_RADIUS_TIERS[0];
            const currentTierIndex = NOTIFICATION_RADIUS_TIERS.indexOf(currentRadius);

            // If already at max tier, skip
            if (currentTierIndex >= NOTIFICATION_RADIUS_TIERS.length - 1) {
                continue;
            }

            // Check if enough time has passed for this tier
            const minutesSinceStart = Math.floor((Date.now() - new Date(order.notification_started_at).getTime()) / 60000);
            const expectedTierIndex = Math.min(
                Math.floor(minutesSinceStart / NOTIFICATION_EXPANSION_MINUTES),
                NOTIFICATION_RADIUS_TIERS.length - 1
            );

            // Only expand if we should be at a higher tier
            if (expectedTierIndex <= currentTierIndex) {
                continue;
            }

            const newRadius = NOTIFICATION_RADIUS_TIERS[expectedTierIndex];

            // Update order with new radius
            await db.execute('UPDATE orders SET notification_radius = ? WHERE id = ?', [newRadius, order.id]);

            // Find online riders within new radius but outside old radius
            const [onlineRiders] = await db.execute('SELECT id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

            if (onlineRiders.length === 0) {
                console.log(`[Order #${order.id}] Tier ${expectedTierIndex + 1} (${newRadius}km): No online riders available`);
                continue;
            }

            const restLat = parseFloat(order.latitude);
            const restLon = parseFloat(order.longitude);

            // Find riders in new radius but NOT in old radius (new riders only)
            const newRiders = onlineRiders
                .map(r => ({
                    ...r,
                    distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
                }))
                .filter(r => r.distance <= newRadius && r.distance > currentRadius)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 10);

            if (newRiders.length === 0) {
                console.log(`[Order #${order.id}] Tier ${expectedTierIndex + 1} (${newRadius}km): No new riders in expanded range`);
                continue;
            }

            // Notify new riders
            newRiders.forEach(rider => {
                io.to(`rider_${rider.id}`).emit('new_order', {
                    orderId: order.id,
                    orderType: 'food',
                    restaurantId: order.restaurant_id,
                    restaurantName: order.restaurant_name,
                    restaurantAddress: order.restaurant_address || '',
                    totalAmount: parseFloat(order.total_amount).toFixed(2),
                    message: `Pickup at ${order.restaurant_name} - ₱${parseFloat(order.total_amount).toFixed(2)}`,
                    estimatedDistance: rider.distance.toFixed(2)
                });
            });

            console.log(`[Order #${order.id}] Tier ${expectedTierIndex + 1} (${newRadius}km): Notified ${newRiders.length} additional riders`);
        }
    } catch (err) {
        console.error('[Tiered Notification Job] Error:', err.message);
    }
}, 60000); // Run every 60 seconds

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (SPA Fallback Active, Socket.io Ready)`);
    console.log(`📡 Tiered notification enabled: ${NOTIFICATION_RADIUS_TIERS.join('km → ')}km (every ${NOTIFICATION_EXPANSION_MINUTES} min)`);
});
