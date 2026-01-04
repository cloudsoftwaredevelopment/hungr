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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Wallet legacy import removed

// New Imports
import { env } from './src/config/env.js';
import app from './src/app.js';
import pool, { db } from './src/config/db.js';
import { initDb } from './src/config/initDb.js';
import { sendError, sendSuccess } from './src/utils/response.js';
import { verifyToken } from './src/middleware/auth.js';
import authRoutes from './src/routes/authRoutes.js';
import merchantRoutes from './src/routes/merchantRoutes.js';
import riderRoutes from './src/routes/riderRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import walletRoutes from './src/routes/walletRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';

import { haversineDistance } from './src/utils/geo.js';

import { createRefundRequest } from './src/services/refundService.js';
import { initializeSocket } from './src/services/socketService.js';
import { initRedis } from './src/services/redisService.js';
import { createAdapter } from '@socket.io/redis-adapter';

const PORT = env.PORT;

const httpServer = createServer(app);
const startServer = async () => {
    // Initialize IO first so it's available for Adapter
    const io = new Server(httpServer, {
        path: '/hungr/socket.io',
        cors: {
            origin: env.CORS_ORIGINS,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Make io accessible to routes
    app.set('io', io);

    // Redis Adapter Setup
    // Use the singleton instance from redisService
    const pubClient = await initRedis();

    if (!pubClient) {
        console.warn('⚠️ Redis disabled - socket scaling disabled (Single Node Mode)');
        app.set('redisConnected', false);
    } else {
        const subClient = pubClient.duplicate();
        try {
            // pubClient is already connected by initRedis(), just connect subClient
            await subClient.connect();
            console.log('✅ Redis Pub/Sub Clients Connected');
            io.adapter(createAdapter(pubClient, subClient));
            app.set('redisConnected', true);
        } catch (err) {
            console.error('❌ Redis Connection Error:', err);
            // If duplicate fails, we can't use the adapter
            app.set('redisConnected', false);
        }
    }

    // ==========================================
    // 🏥 HEALTH CHECK ENDPOINT
    // ==========================================
    app.get('/api/health', async (req, res) => {
        try {
            // Simple DB Check
            await db.execute('SELECT 1');

            const redisConnected = app.get('redisConnected');
            const status = redisConnected ? 'ok' : 'degraded';

            res.json({
                status,
                redis: redisConnected ? 'connected' : 'disconnected',
                db: 'connected',
                uptime: process.uptime(),
                instance: process.env.NODE_APP_INSTANCE || '0',
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                status: 'error',
                redis: app.get('redisConnected') ? 'connected' : 'disconnected',
                db: 'disconnected',
                error: err.message
            });
        }
    });

    // ==========================================
    // 🔌 SOCKET.IO CONNECTION HANDLER
    // ==========================================
    initializeSocket(io);

    // Internal API uses 'io' so it's fine here as long as io is defined
    app.post('/api/internal/socket', express.json(), (req, res) => {
        // IP Whitelist Check (Localhost only)
        const remoteIp = req.socket.remoteAddress;
        // Allow IPv4 localhost (127.0.0.1) and IPv6 localhost (::1) and ::ffff:127.0.0.1
        if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
            return res.status(403).send('Forbidden');
        }

        const { event, data, room } = req.body;
        if (!event || !data) return res.status(400).send('Missing event or data');

        if (room) {
            io.to(room).emit(event, data);
        } else {
            io.emit(event, data);
        }
        res.send({ success: true });
    });

    // ==========================================
    // 📂 UPLOADS DIRECTORY
    // ==========================================
    const uploadsDir = path.join(__dirname, 'uploads', 'menu');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // ==========================================
    // 🏪 API ROUTING
    // ==========================================
    const apiRouter = express.Router();
    apiRouter.use('/auth', authRoutes);
    apiRouter.use('/merchant', merchantRoutes);
    apiRouter.use('/riders', riderRoutes);
    apiRouter.use('/', walletRoutes);
    apiRouter.use('/admin', adminRoutes);
    apiRouter.use('/', customerRoutes);

    app.use('/api', apiRouter);
    app.use('/hungr/api', apiRouter);
    app.use('/hungrriders/api', apiRouter);

    // ==========================================
    // 🌐 SPA FALLBACK
    // ==========================================
    app.get('*', (req, res) => {
        // API 404
        if (req.url.startsWith('/api/') || req.url.startsWith('/hungr/api/') || req.url.startsWith('/hungrriders/api/')) {
            return sendError(res, 404, 'API Endpoint not found');
        }

        // Static Asset 404
        if (req.url.startsWith('/uploads/') || req.url.startsWith('/hungr/uploads/')) {
            return res.status(404).send('File not found');
        }

        // Frontend (Serve React App)
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (SPA Fallback Active, Socket.io Ready)`);
    });
};

startServer();
