import { db } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { haversineDistance } from '../utils/geo.js';
import { processCustomerPayment, getCustomerBalance } from '../routes/walletRoutes.js';

const getIO = (req) => req.app.get('io');

// ==========================================
// 👤 USER / PROFILE
// ==========================================

export const getUserAddresses = async (req, res) => {
    try {
        const userId = req.user.id;
        const [results] = await db.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
};

export const saveUserAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { label, address, latitude, longitude, is_default } = req.body;

        if (!label || !address) return sendError(res, 400, "Label and Address required");

        // Upsert
        const sql = `INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default) 
                         VALUES (?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE address = VALUES(address), latitude = VALUES(latitude), longitude = VALUES(longitude)`;

        const params = [userId, label, address, latitude || null, longitude || null, is_default ? 1 : 0];

        const [result] = await db.query(sql, params);

        sendSuccess(res, { id: result.insertId, label, address }, "Address saved");
    } catch (err) {
        sendError(res, 500, "Save failed", "DB_ERROR", err);
    }
};

export const deleteUserAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        const addressId = req.params.id;

        const [result] = await db.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);

        if (result.affectedRows === 0) return sendError(res, 404, "Address not found or unauthorized");

        sendSuccess(res, null, "Address deleted");
    } catch (err) {
        sendError(res, 500, "Delete failed", "DB_ERROR", err);
    }
};

export const updateUserLocation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude, address } = req.body;

        if (!latitude || !longitude) {
            return sendError(res, 400, "Latitude and longitude are required");
        }

        await db.execute(
            'UPDATE users SET latitude = ?, longitude = ?, address = ? WHERE id = ?',
            [latitude, longitude, address || null, userId]
        );

        console.log(`[User] User #${userId} location updated: ${latitude}, ${longitude}`);
        sendSuccess(res, { latitude, longitude, address }, "Location updated successfully");
    } catch (err) {
        sendError(res, 500, "Failed to update location", "DB_ERROR", err);
    }
};

export const getUserLocation = async (req, res) => {
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
};

export const getMyRiderProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.execute('SELECT * FROM riders WHERE user_id = ?', [userId]);
        if (rows.length === 0) return sendError(res, 404, "Rider profile not found");
        sendSuccess(res, rows[0]);
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
};


// ==========================================
// 🛍️ RESTAURANTS & STORES
// ==========================================

export const getPabiliStores = async (req, res) => {
    try {
        const category = req.query.category;
        let query = 'SELECT * FROM stores';
        let params = [];
        if (category && category !== 'All') {
            query += ' WHERE category = ?';
            params.push(category);
        }

        query += ' ORDER BY rating DESC';

        const [results] = await db.query(query, params);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
};

export const searchPabili = async (req, res) => {
    try {
        const { q, lat, long } = req.query;
        if (!q) return sendError(res, 400, "Query required");

        let sql = `SELECT DISTINCT s.* FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ? LIMIT 20`;
        let params = [`%${q}%`, `%${q}%`, `%${q}%`];

        if (lat && long) {
            sql = `SELECT DISTINCT s.*, ( 6371 * acos( cos( radians(?) ) * cos( radians( s.latitude ) ) * cos( radians( s.longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( s.latitude ) ) ) ) AS distance FROM stores s LEFT JOIN products p ON s.id = p.store_id WHERE (s.name LIKE ? OR p.name LIKE ? OR p.description LIKE ?) HAVING distance < 4 ORDER BY distance ASC LIMIT 20`;
            params = [lat, long, lat, `%${q}%`, `%${q}%`, `%${q}%`];
        }
        const [results] = await db.query(sql, params);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, "DB Search Error", "DB_ERROR", err);
    }
};

export const getStoreProducts = async (req, res) => {
    try {
        const storeId = req.params.id;
        const [products] = await db.query('SELECT * FROM products WHERE store_id = ?', [storeId]);
        sendSuccess(res, products);
    } catch (err) {
        sendError(res, 500, "DB Error", "DB_ERROR", err);
    }
};

export const getPremiumRestaurants = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT id, name, cuisine_type, image_url, rating, delivery_time_min, delivery_time_max,
                   premium_banner_image, premium_tagline
            FROM restaurants 
            WHERE is_premium = 1 
              AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
            ORDER BY rating DESC
            LIMIT 10
        `);

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
};

import { cacheGet, cacheSet } from '../services/redisService.js';

export const getRestaurants = async (req, res) => {
    try {
        const cacheKey = 'restaurants:all';
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return sendSuccess(res, cached);
        }

        const [results] = await db.query('SELECT * FROM restaurants ORDER BY rating DESC');
        await cacheSet(cacheKey, results, 300); // Cache for 5 mins

        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
};

export const getRestaurantMenu = async (req, res) => {
    try {
        const idOrSlug = req.params.idOrSlug;
        const cacheKey = `restaurant:menu:${idOrSlug}`;

        const cached = await cacheGet(cacheKey);
        if (cached) {
            return sendSuccess(res, cached);
        }

        const isNumeric = /^\d+$/.test(idOrSlug);

        let restaurantRows;
        if (isNumeric) {
            [restaurantRows] = await db.execute('SELECT * FROM restaurants WHERE id = ?', [idOrSlug]);
        } else {
            [restaurantRows] = await db.execute('SELECT * FROM restaurants WHERE slug = ?', [idOrSlug.toLowerCase()]);
        }

        if (restaurantRows.length === 0) return sendError(res, 404, 'Restaurant not found');
        const restaurant = restaurantRows[0];

        const [menuItems] = await db.query('SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY category, name', [restaurant.id]);

        const responseData = { restaurant, menu: menuItems };
        await cacheSet(cacheKey, responseData, 300); // Cache for 5 mins

        sendSuccess(res, responseData);
    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
};

export const watchRestaurant = async (req, res) => {
    try {
        const restaurantId = req.params.id;
        const userId = req.user.id;

        const [restRows] = await db.execute('SELECT is_available, name FROM restaurants WHERE id = ?', [restaurantId]);
        if (restRows.length === 0) return sendError(res, 404, 'Restaurant not found');

        if (restRows[0].is_available === 1) {
            return sendSuccess(res, { watching: false }, 'Restaurant is already open');
        }

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
};


// ==========================================
// 📦 ORDERS
// ==========================================

export const getOrderHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const [foodOrders] = await db.execute(`
            SELECT 
                o.id,
                o.total_amount as amount,
                o.status,
                o.created_at,
                o.rider_id,
                o.dispatch_code,
                o.delivery_eta_arrival,
                r.name as merchant_name,
                'food' as type
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [userId]);

        const [storeOrders] = await db.execute(`
            SELECT 
                o.id,
                o.total_amount as amount,
                o.status,
                o.created_at,
                o.rider_id,
                o.delivery_eta_arrival,
                s.name as merchant_name,
                'store' as type
            FROM store_paid_orders o
            LEFT JOIN stores s ON o.store_id = s.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [userId]);

        const allOrders = [...foodOrders, ...storeOrders]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);

        sendSuccess(res, allOrders);
    } catch (err) {
        console.error('Order history error:', err);
        sendError(res, 500, 'Failed to fetch order history');
    }
};

export const getActiveOrder = async (req, res) => {
    try {
        const userId = req.user.id;

        const [foodOrders] = await db.execute(`
            SELECT o.id, o.status, o.total_amount, r.name as merchant_name, 'food' as type, o.created_at,
            o.delivery_eta_arrival, o.dispatch_code,
            p.accepted_at,
            JSON_ARRAYAGG(
                JSON_OBJECT('id', oi.id, 'name', m.name, 'quantity', oi.quantity, 'price', oi.price_at_time, 'preparation_time_min', m.preparation_time_min, 'preparation_time_sec', m.preparation_time_sec)
            ) as items
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN menu_items m ON oi.menu_item_id = m.id
            LEFT JOIN prepared_orders p ON o.id = p.order_id AND p.order_type = 'food'
            WHERE o.user_id = ? AND o.status NOT IN ('delivered', 'cancelled', 'completed')
            GROUP BY o.id
            ORDER BY o.created_at DESC LIMIT 1
        `, [userId]);

        const [storeOrders] = await db.execute(`
            SELECT o.id, o.status, o.total_amount, s.name as merchant_name, 'store' as type, o.created_at,
            o.delivery_eta_arrival,
            p.accepted_at,
            JSON_ARRAYAGG(
                JSON_OBJECT('name', i.product_name, 'quantity', i.quantity, 'price', i.price, 'preparation_time_min', 0, 'preparation_time_sec', 0)
            ) as items
            FROM store_paid_orders o
            LEFT JOIN stores s ON o.store_id = s.id
            JOIN store_order_items i ON o.id = i.order_id
            LEFT JOIN prepared_orders p ON o.id = p.order_id AND p.order_type = 'store'
            WHERE o.user_id = ? AND o.status NOT IN ('delivered', 'cancelled', 'completed')
            GROUP BY o.id
            ORDER BY o.created_at DESC LIMIT 1
        `, [userId]);

        const activeOrders = [...foodOrders, ...storeOrders]
            .map(row => ({ ...row, items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (activeOrders.length > 0) {
            return sendSuccess(res, activeOrders[0]);
        }

        sendSuccess(res, null, 'No active orders found');
    } catch (err) {
        console.error('Active order fetch error:', err);
        sendError(res, 500, 'Failed to fetch active order');
    }
};

import { OrderService } from '../services/orderService.js';

export const createPabiliOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.body.store_id || !req.body.items || !req.body.items.length || !req.body.estimated_cost) {
            return sendError(res, 400, "Missing required fields");
        }

        const result = await OrderService.createPabiliOrder(userId, req.body);
        console.log(`[Pabili] Order #${result.orderId} created. Notifying ${result.riders.length} riders.`);
        sendSuccess(res, { orderId: result.orderId, ridersNotified: result.riders.length }, "Order created and riders notified");

    } catch (err) {
        sendError(res, 500, "Failed to create Pabili order", "DB_ERROR", err);
    }
};

export const cancelPabiliOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { rider_id, reason } = req.body;
        await OrderService.cancelPabiliOrder(orderId, rider_id, reason);
        console.log(`[Pabili] Order #${orderId} was cancelled by Rider #${rider_id}. Status reset to PENDING.`);
        sendSuccess(res, null, "Order cancelled and reset to pending");
    } catch (err) {
        sendError(res, 500, "Cancellation failed");
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const io = getIO(req);

        // Fetch user details for service
        const [[user]] = await db.execute('SELECT username, phone_number FROM users WHERE id = ?', [userId]);

        try {
            const result = await OrderService.placeOrder(userId, user || {}, req.body, io);

            if (req.body.orderType === 'ride') {
                console.log(`[RideOrder #${result.orderId}] Created.`);
                return sendSuccess(res, { orderId: result.orderId, ridersNotified: result.ridersNotified }, "Ride booked successfully");
            } else if (req.body.orderType === 'store' && req.body.storeId) {
                console.log(`[StoreOrder #${result.orderId}] Created.`);
                return sendSuccess(res, { orderId: result.orderId, ridersNotified: result.ridersNotified }, "Order placed successfully");
            } else {
                console.log(`[FoodOrder #${result.orderId}] Created.`);
                return sendSuccess(res, { orderId: result.orderId }, "Food Order placed successfully");
            }

        } catch (err) {
            if (err.code === 'INSUFFICIENT_FUNDS') {
                return sendError(res, 400, err.message, 'INSUFFICIENT_FUNDS');
            }
            if (err.message === 'Restaurant is currently offline/closed.') {
                return sendError(res, 400, err.message);
            }
            console.error(`[OrderService Error] ${err.message}`);
            throw err; // Let global handler or generic catch handle generic errors
        }

    } catch (err) {
        sendError(res, 500, "Order Creation Failed", "DB_ERROR", err);
    }
};
