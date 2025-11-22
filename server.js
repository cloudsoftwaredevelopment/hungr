/**
 * Hungr Backend API - Phase 1 Update (Fixed)
 * Better error logging and SQL error handling
 * Using ES Modules (import) to match Vite's package.json type
 */

import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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

// --- HELPER FUNCTIONS ---

/**
 * Group menu items by category
 * @param {Array} items - Array of menu items from database
 * @returns {Object} Items grouped by category
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

// --- API ROUTES ---

// 1. Health Check
app.get('/api/health', (req, res) => {
    sendSuccess(res, { status: 'Server is running' });
});

// 2. Get All Restaurants
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

// 3. Get Menu for a Restaurant - WITH GROUPING
app.get('/api/restaurants/:id/menu', (req, res) => {
    const restaurantId = req.params.id;
    
    // Validate restaurant ID
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
        
        // Group items by category
        const groupedMenu = groupMenuByCategory(results);
        
        if (Object.keys(groupedMenu).length === 0) {
            return sendError(res, 404, 'No menu items found for this restaurant', 'MENU_NOT_FOUND');
        }
        
        sendSuccess(res, groupedMenu);
    });
});

// 4. Create Order - WITH VALIDATION & TRANSACTION & BETTER ERROR LOGGING
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
});
