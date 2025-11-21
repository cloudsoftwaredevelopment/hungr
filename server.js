/**
 * Hungr Backend API
 * Updated to use ES Modules (import) to match Vite's package.json type
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

// --- API ROUTES ---

// 1. Get All Restaurants
app.get('/api/restaurants', (req, res) => {
    const query = 'SELECT * FROM restaurants';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Get Menu for a Restaurant
app.get('/api/restaurants/:id/menu', (req, res) => {
    const restaurantId = req.params.id;
    const query = 'SELECT * FROM menu_items WHERE restaurant_id = ?';
    db.query(query, [restaurantId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 3. Create Order
app.post('/api/orders', (req, res) => {
    const { userId, restaurantId, total, items } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items in order" });
    }

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: err.message });

        connection.beginTransaction(err => {
            if (err) { connection.release(); return res.status(500).json({ error: err.message }); }

            const orderQuery = 'INSERT INTO orders (user_id, restaurant_id, total_amount, status) VALUES (?, ?, ?, "pending")';
            connection.query(orderQuery, [userId || 1, restaurantId, total], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: err.message });
                    });
                }

                const orderId = result.insertId;
                const itemValues = items.map(item => [orderId, item.id, item.quantity, item.price]);
                const itemsQuery = 'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ?';

                connection.query(itemsQuery, [itemValues], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: err.message });
                        });
                    }

                    connection.commit(err => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ error: err.message });
                            });
                        }
                        connection.release();
                        res.json({ message: 'Order placed successfully', orderId });
                    });
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Hungr Server running on port ${PORT}`);
});
