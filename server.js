/**
 * server.js - Hungr Backend
 * Phase 1 + Phase 2 (Auth, Address, Wallet, Coins)
 */

import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secrets
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_change_this';
const JWT_EXPIRY = '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRY = 30 * 60; // Refresh token expires in 30 minutes (in seconds)

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:5173', 'https://nfcrevolution.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Database Connection Pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error connecting to MariaDB:', err.message);
    } else {
        console.log('✅ Connected to MariaDB database.');
        connection.release();
    }
});

// --- STANDARDIZED ERROR RESPONSE ---
const sendError = (res, statusCode, message, code = 'ERROR', sqlError = null) => {
    console.error(`[ERROR ${statusCode}] ${code}: ${message}`);
    if (sqlError) {
        console.error('[SQL ERROR]', sqlError.message);
    }
    res.status(statusCode).json({
        success: false,
        error: message,
        code: code
    });
};

const sendSuccess = (res, data, message = null, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data: data,
        ...(message && { message })
    });
};

// --- JWT MIDDLEWARE ---

/**
 * Verify JWT token from Authorization header
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return sendError(res, 401, 'No token provided', 'NO_TOKEN');
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return sendError(res, 403, 'Invalid or expired token', 'INVALID_TOKEN');
        }
        req.user = decoded;
        next();
    });
};

// --- HELPER FUNCTIONS ---

/**
 * Group menu items by category
 */
const groupMenuByCategory = (items) => {
    return items.reduce((acc, item) => {
        const category = item.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});
};

/**
 * Generate JWT token
 */
const generateToken = (userId, expiresIn = JWT_EXPIRY) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
};

/**
 * Generate Refresh Token
 */
const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '30m' });
};

/**
 * Hash password with bcrypt
 */
const hashPassword = async (password) => {
    return bcrypt.hash(password, 10);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// --- API ROUTES ---

// 1. Health Check
app.get('/api/health', (req, res) => {
    sendSuccess(res, { status: 'Server is running' });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// 2. Sign Up
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, phone_number } = req.body;

    console.log('[SIGNUP] Received signup request:', { username, email, phone_number });

    // Validation
    if (!username || !email || !password) {
        return sendError(res, 400, 'Username, email, and password are required', 'MISSING_FIELDS');
    }

    if (password.length < 6) {
        return sendError(res, 400, 'Password must be at least 6 characters', 'WEAK_PASSWORD');
    }

    try {
        // Hash password
        const passwordHash = await hashPassword(password);

        const query = `
            INSERT INTO users (username, email, password_hash, phone_number)
            VALUES (?, ?, ?, ?)
        `;

        db.query(query, [username, email, passwordHash, phone_number || null], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return sendError(res, 400, 'Username or email already exists', 'USER_EXISTS', err);
                }
                return sendError(res, 500, 'Failed to create user', 'DB_ERROR', err);
            }

            const userId = result.insertId;
            console.log('[SIGNUP] User created with ID:', userId);

            // Create initial coin balance
            const coinQuery = 'INSERT INTO hungr_coins (user_id, balance) VALUES (?, 0)';
            db.query(coinQuery, [userId], (coinErr) => {
                if (coinErr) console.error('[COIN ERROR]', coinErr.message);
            });

            // Create initial wallet
            const walletQuery = 'INSERT INTO wallets (user_id, balance) VALUES (?, 0)';
            db.query(walletQuery, [userId], (walletErr) => {
                if (walletErr) console.error('[WALLET ERROR]', walletErr.message);
            });

            // Generate tokens
            const accessToken = generateToken(userId);
            const refreshToken = generateRefreshToken(userId);

            // Store refresh token in database
            const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
            const storeTokenQuery = 'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
            db.query(storeTokenQuery, [userId, refreshToken, refreshTokenExpiry], (tokenErr) => {
                if (tokenErr) console.error('[REFRESH TOKEN ERROR]', tokenErr.message);
            });

            // Set HttpOnly cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: REFRESH_TOKEN_EXPIRY * 1000
            });

            console.log(`✅ User ${username} registered successfully`);

            sendSuccess(res, {
                userId: userId,
                username: username,
                email: email,
                accessToken: accessToken
            }, 'User registered successfully', 201);
        });
    } catch (err) {
        console.error('[SIGNUP ERROR]', err.message);
        sendError(res, 500, 'Signup failed', 'SIGNUP_ERROR');
    }
});

// 3. Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    console.log('[LOGIN] Received login request:', { email });

    // Validation
    if (!email || !password) {
        return sendError(res, 400, 'Email and password are required', 'MISSING_FIELDS');
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            return sendError(res, 500, 'Login failed', 'DB_ERROR', err);
        }

        if (!results || results.length === 0) {
            return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
        }

        const user = results[0];

        try {
            // Verify password
            const passwordMatch = await comparePassword(password, user.password_hash);

            if (!passwordMatch) {
                return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
            }

            // Generate tokens
            const accessToken = generateToken(user.id);
            const refreshToken = generateRefreshToken(user.id);

            // Store refresh token in database
            const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
            const storeTokenQuery = 'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
            db.query(storeTokenQuery, [user.id, refreshToken, refreshTokenExpiry], (tokenErr) => {
                if (tokenErr) console.error('[REFRESH TOKEN ERROR]', tokenErr.message);
            });

            // Set HttpOnly cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: REFRESH_TOKEN_EXPIRY * 1000
            });

            console.log(`✅ User ${user.username} logged in successfully`);

            sendSuccess(res, {
                userId: user.id,
                username: user.username,
                email: user.email,
                phone_number: user.phone_number,
                accessToken: accessToken
            }, 'Login successful');
        } catch (err) {
            console.error('[LOGIN ERROR]', err.message);
            sendError(res, 500, 'Login failed', 'LOGIN_ERROR');
        }
    });
});

// 4. Refresh Token
app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    console.log('[REFRESH] Received refresh token request');

    if (!refreshToken) {
        return sendError(res, 401, 'No refresh token provided', 'NO_REFRESH_TOKEN');
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) {
            return sendError(res, 403, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
        }

        const userId = decoded.userId;
        const newAccessToken = generateToken(userId);

        console.log(`✅ Access token refreshed for user ${userId}`);

        sendSuccess(res, {
            accessToken: newAccessToken
        }, 'Token refreshed');
    });
});

// 5. Logout
app.post('/api/auth/logout', (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    console.log('[LOGOUT] Received logout request');

    if (refreshToken) {
        // Delete refresh token from database
        db.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], (err) => {
            if (err) console.error('[DELETE TOKEN ERROR]', err.message);
        });
    }

    // Clear cookie
    res.clearCookie('refreshToken');

    console.log('✅ User logged out successfully');

    sendSuccess(res, {}, 'Logout successful');
});

// ==========================================
// USER ENDPOINTS
// ==========================================

// 6. Get User Profile (Protected)
app.get('/api/users/profile', verifyToken, (req, res) => {
    const userId = req.user.userId;

    console.log('[PROFILE] Fetching profile for user:', userId);

    const query = 'SELECT id, username, email, phone_number, address, created_at FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch profile', 'DB_ERROR', err);
        }

        if (!results || results.length === 0) {
            return sendError(res, 404, 'User not found', 'USER_NOT_FOUND');
        }

        sendSuccess(res, results[0]);
    });
});

// ==========================================
// COIN ENDPOINTS
// ==========================================

// 7. Get Coin Balance (Protected)
app.get('/api/users/coins', verifyToken, (req, res) => {
    const userId = req.user.userId;

    console.log('[COINS] Fetching coin balance for user:', userId);

    const query = 'SELECT balance FROM hungr_coins WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch coin balance', 'DB_ERROR', err);
        }

        const balance = results && results.length > 0 ? results[0].balance : 0;
        sendSuccess(res, { balance: balance });
    });
});

// 8. Get Coin Transaction History (Protected)
app.get('/api/users/coins/transactions', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    console.log('[COINS] Fetching coin transactions for user:', userId);

    const query = `
        SELECT * FROM coin_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `;
    db.query(query, [userId, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch coin transactions', 'DB_ERROR', err);
        }

        sendSuccess(res, results);
    });
});

// ==========================================
// WALLET ENDPOINTS
// ==========================================

// 9. Get Wallet Balance (Protected)
app.get('/api/users/wallet', verifyToken, (req, res) => {
    const userId = req.user.userId;

    console.log('[WALLET] Fetching wallet balance for user:', userId);

    const query = 'SELECT balance FROM wallets WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch wallet balance', 'DB_ERROR', err);
        }

        const balance = results && results.length > 0 ? results[0].balance : 0;
        sendSuccess(res, { balance: balance });
    });
});

// 10. Get Wallet Transaction History (Protected)
app.get('/api/users/wallet/transactions', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    console.log('[WALLET] Fetching wallet transactions for user:', userId);

    const query = `
        SELECT * FROM wallet_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `;
    db.query(query, [userId, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch wallet transactions', 'DB_ERROR', err);
        }

        sendSuccess(res, results);
    });
});

// ==========================================
// RESTAURANT & MENU ENDPOINTS (Phase 1)
// ==========================================

// 11. Get All Restaurants
app.get('/api/restaurants', (req, res) => {
    const query = 'SELECT * FROM restaurants ORDER BY is_featured DESC, rating DESC';

    db.query(query, (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch restaurants', 'DB_QUERY_ERROR', err);
        }

        if (!results || results.length === 0) {
            console.log('[INFO] No restaurants found');
        }

        sendSuccess(res, results);
    });
});

// 12. Get Menu for a Restaurant
app.get('/api/restaurants/:id/menu', (req, res) => {
    const restaurantId = req.params.id;

    if (!restaurantId || isNaN(restaurantId)) {
        return sendError(res, 400, 'Invalid restaurant ID', 'INVALID_ID');
    }

    const query = `
        SELECT m.* FROM menu_items m
        WHERE m.restaurant_id = ?
        ORDER BY m.category ASC, m.name ASC
    `;

    db.query(query, [restaurantId], (err, results) => {
        if (err) {
            return sendError(res, 500, 'Failed to fetch menu items', 'DB_QUERY_ERROR', err);
        }

        const groupedMenu = groupMenuByCategory(results);

        if (Object.keys(groupedMenu).length === 0) {
            return sendError(res, 404, 'No menu items found for this restaurant', 'MENU_NOT_FOUND');
        }

        sendSuccess(res, groupedMenu);
    });
});

// ==========================================
// ORDER ENDPOINTS
// ==========================================

// 13. Create Order
app.post('/api/orders', (req, res) => {
    const { userId, restaurantId, items, total } = req.body;

    console.log('[ORDER] Received order request:', { userId, restaurantId, itemsCount: items?.length, total });

    // Validate request
    if (!restaurantId || isNaN(restaurantId)) {
        return sendError(res, 400, 'Invalid or missing restaurant ID', 'INVALID_RESTAURANT_ID');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 400, 'Order must contain at least one item', 'EMPTY_ORDER');
    }

    if (!total || isNaN(total) || total <= 0) {
        return sendError(res, 400, 'Invalid total amount', 'INVALID_TOTAL');
    }

    // Validate each item
    for (let item of items) {
        if (!item.id || !item.quantity || !item.price) {
            return sendError(res, 400, 'All items must have id, quantity, and price', 'INVALID_ITEM');
        }
        if (isNaN(item.quantity) || item.quantity <= 0) {
            return sendError(res, 400, 'Item quantity must be greater than 0', 'INVALID_QUANTITY');
        }
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error('[DB CONNECTION ERROR]', err.message);
            return sendError(res, 500, 'Database connection failed', 'DB_CONNECTION_ERROR', err);
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                console.error('[TRANSACTION ERROR]', err.message);
                return sendError(res, 500, 'Transaction start failed', 'TRANSACTION_ERROR', err);
            }

            // Insert order
            const orderQuery = `
                INSERT INTO orders (user_id, restaurant_id, total_amount, status)
                VALUES (?, ?, ?, 'pending')
            `;

            console.log('[SQL] Inserting order with params:', [userId || 1, restaurantId, total]);

            connection.query(orderQuery, [userId || 1, restaurantId, total], (err, result) => {
                if (err) {
                    console.error('[ORDER INSERT ERROR]', err.message, err.code, err.sql);
                    return connection.rollback(() => {
                        connection.release();
                        sendError(res, 500, 'Failed to create order', 'ORDER_INSERT_ERROR', err);
                    });
                }

                const orderId = result.insertId;
                console.log('[ORDER CREATED] Order ID:', orderId);

                // Prepare order items
                const itemValues = items.map(item => [
                    orderId,
                    item.id,
                    item.quantity,
                    item.price
                ]);

                // Insert order items
                const itemsQuery = `
                    INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
                    VALUES ?
                `;

                console.log('[SQL] Inserting order items for order:', orderId, '| Items count:', itemValues.length);

                connection.query(itemsQuery, [itemValues], (err) => {
                    if (err) {
                        console.error('[ORDER ITEMS INSERT ERROR]', err.message, err.code, err.sql);
                        return connection.rollback(() => {
                            connection.release();
                            sendError(res, 500, 'Failed to add items to order', 'ORDER_ITEMS_ERROR', err);
                        });
                    }

                    // Commit transaction
                    connection.commit((err) => {
                        if (err) {
                            console.error('[COMMIT ERROR]', err.message);
                            return connection.rollback(() => {
                                connection.release();
                                sendError(res, 500, 'Transaction commit failed', 'COMMIT_ERROR', err);
                            });
                        }

                        connection.release();
                        console.log(`✅ Order #${orderId} placed successfully with ${items.length} items`);

                        sendSuccess(res, {
                            orderId: orderId,
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        }, 'Order placed successfully', 201);
                    });
                });
            });
        });
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Hungr Server running on port ${PORT}`);
    console.log(`📍 API Base URL: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 JWT Expiry: ${JWT_EXPIRY}`);
    console.log(`🔄 Refresh Token Expiry: ${REFRESH_TOKEN_EXPIRY / 60} minutes`);
});
