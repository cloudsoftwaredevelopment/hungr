/**
 * server.js - Hungr Backend
 * Status: STABILITY FIX (Removed is_featured, Aggressive SPA Fallback)
 * Updated: Handling Store Paid Orders & Rider Allocation
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Wallet legacy import removed

// New Imports
import { env } from './src/config/env.js';
import app from './src/app.js';
import pool, { db } from './src/config/db.js';
import { initDb } from './src/config/initDb.js';
import { sendError, sendSuccess } from './src/utils/response.js';
import { verifyToken, generateToken } from './src/middleware/auth.js';
import authRoutes from './src/routes/authRoutes.js';
import merchantRoutes from './src/routes/merchantRoutes.js';
import riderRoutes from './src/routes/riderRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import walletRoutes from './src/routes/walletRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';

import { haversineDistance } from './src/utils/geo.js';
import { createRefundRequest } from './src/services/refundService.js';
const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/hungr/socket.io',
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173', 'https://nfcrevolution.com'],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Make io accessible to routes
app.set('io', io);

const PORT = env.PORT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB on startup
initDb();

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRY = env.JWT_EXPIRY;



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

// ==========================================
// 🔒 INTERNAL API (FOR WORKER PROCESS)
// ==========================================
app.post('/api/internal/socket', (req, res) => {
    const internalKey = req.headers['x-internal-key'];
    if (internalKey !== env.INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { room, event, data } = req.body;

    if (!event || !data) {
        return res.status(400).json({ error: 'Missing event or data' });
    }

    if (room) {
        io.to(room).emit(event, data);
        console.log(`[InternalAPI] Emitted ${event} to room ${room}`);
    } else {
        io.emit(event, data);
        console.log(`[InternalAPI] Broadcasted ${event}`);
    }

    res.json({ success: true });
});

// Helper function to notify closest riders via Socket.io



// Define uploads directory for Multer
const uploadsDir = path.join(__dirname, 'uploads', 'menu');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}


// DB Helper is now imported from src/config/db.js


// --- HELPER FUNCTIONS ---

// Haversine Algo

// Get customer order history


// 2. Toggle Status



// ==========================================
// 🏪 MERCHANT API
// ==========================================
// Mount API Router for clean /api path handling
const apiRouter = express.Router();
// Customer routes mounted first/root as they have mixed paths
apiRouter.use('/', customerRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/merchant', merchantRoutes);
apiRouter.use('/riders', riderRoutes);
apiRouter.use('/', walletRoutes);
apiRouter.use('/admin', adminRoutes);





// Customer Auth
// Customer Addresses

// Customer balance routes are now managed by walletRoutes.js

// Real Address Persistence


// Mount Router
// Register wallet API routes
// Wallet routes registered via router use above

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


// Admin routes mounted via adminRoutes.js

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (SPA Fallback Active, Socket.io Ready)`);
});
