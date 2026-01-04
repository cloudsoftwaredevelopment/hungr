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

export const getRestaurants = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM restaurants ORDER BY rating DESC');
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
};

export const getRestaurantMenu = async (req, res) => {
    try {
        const idOrSlug = req.params.idOrSlug;
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

        sendSuccess(res, { restaurant, menu: menuItems });
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

export const createPabiliOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { store_id, items, estimated_cost, delivery_address } = req.body;

        if (!store_id || !items || !items.length || !estimated_cost) {
            return sendError(res, 400, "Missing required fields");
        }

        const [orderResult] = await db.execute(
            `INSERT INTO pabili_orders (user_id, store_id, estimated_cost, delivery_address, status) VALUES (?, ?, ?, ?, 'pending')`,
            [userId, store_id, estimated_cost, delivery_address || '']
        );
        const pabiliId = orderResult.insertId;

        for (const item of items) {
            await db.execute(
                `INSERT INTO pabili_items (pabili_order_id, name, quantity) VALUES (?, ?, ?)`,
                [pabiliId, item.name, item.quantity]
            );
        }

        // Find Riders (Mock Logic)
        const [riders] = await db.query(`
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
};

export const cancelPabiliOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { rider_id, reason } = req.body;

        await db.execute(
            `INSERT INTO cancelled_orders (order_id, order_type, rider_id, reason) VALUES (?, 'pabili', ?, ?)`,
            [orderId, rider_id, reason || 'Rider cancelled']
        );

        await db.execute(
            `UPDATE pabili_orders SET status = 'pending', rider_id = NULL WHERE id = ?`,
            [orderId]
        );

        console.log(`[Pabili] Order #${orderId} was cancelled by Rider #${rider_id}. Status reset to PENDING.`);

        sendSuccess(res, null, "Order cancelled and reset to pending");

    } catch (err) {
        sendError(res, 500, "Cancellation failed");
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { restaurantId, storeId, orderType, items, total, paymentMethod, instructions, substitutionPreference } = req.body;
        const io = getIO(req);

        // Fetch user details for real-time notifications to merchants
        const [[user]] = await db.execute('SELECT username, phone_number FROM users WHERE id = ?', [userId]);
        const customerName = user ? user.username : 'Customer';
        const customerPhone = user ? user.phone_number : 'N/A';

        // Balance Check
        const normalizedPaymentMethod = (paymentMethod || '').toLowerCase();
        if (normalizedPaymentMethod === 'wallet' || normalizedPaymentMethod === 'coins') {
            try {
                const balance = await getCustomerBalance(userId, normalizedPaymentMethod);
                const amountToDeduct = parseFloat(total);

                if (isNaN(amountToDeduct) || amountToDeduct <= 0) {
                    return sendError(res, 400, "Invalid order total amount");
                }

                if (balance < amountToDeduct) {
                    return sendError(res, 400, `Insufficient ${normalizedPaymentMethod} balance. Required: ₱${amountToDeduct}, Available: ₱${balance}`, 'INSUFFICIENT_FUNDS');
                }
                console.log(`[Checkout] Balance check passed for user #${userId} (${normalizedPaymentMethod}): ₱${balance}`);
            } catch (err) {
                console.error(`[Checkout Check Error] ${err.message}`);
                return sendError(res, 500, "Payment validation failed");
            }
        }

        if (orderType === 'store' && storeId) {
            // === HANDLING STORE ORDER ===
            const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
            const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";

            // Payment method normalization
            let normalizedPayment = normalizedPaymentMethod;
            if (normalizedPayment === 'cash' || !normalizedPayment) normalizedPayment = 'COD';
            else if (normalizedPayment === 'wallet') normalizedPayment = 'Wallet';
            else if (normalizedPayment === 'coins') normalizedPayment = 'Coins';
            else normalizedPayment = normalizedPayment.toUpperCase();

            const [orderResult] = await db.execute(
                `INSERT INTO store_paid_orders (user_id, store_id, total_amount, payment_method, delivery_address, status, instructions, substitution_preference) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
                [userId, storeId, total, normalizedPayment, deliveryAddress, instructions || null, substitutionPreference || 'call']
            );
            const orderId = orderResult.insertId;

            if (normalizedPaymentMethod === 'wallet' || normalizedPaymentMethod === 'coins') {
                try {
                    const payRes = await processCustomerPayment(userId, total, orderId, normalizedPaymentMethod);
                    console.log(`[Payment] Deducted ${total} from user #${userId} ${normalizedPaymentMethod}. Transaction: ${payRes.transactionId}`);
                } catch (payErr) {
                    console.error(`[Payment Error] Post-order debit failed: ${payErr.message}`);
                    return sendError(res, 500, "Payment processing failed. Please contact support.");
                }
            }

            if (items && items.length > 0) {
                const itemValues = items.map(i => [orderId, i.id, i.name, i.quantity, i.price || 0]);
                await db.query('INSERT INTO store_order_items (order_id, product_id, product_name, quantity, price) VALUES ?', [itemValues]);
            }

            // Rider Allocation Logic
            const [storeRows] = await db.execute('SELECT * FROM stores WHERE id = ?', [storeId]);
            const storeData = storeRows[0] || {};
            const storeLoc = {
                latitude: storeData.latitude || 10.7202,
                longitude: storeData.longitude || 122.5621
            };

            const [onlineRiders] = await db.execute('SELECT id, name, current_latitude as latitude, current_longitude as longitude FROM riders WHERE is_online = 1');

            const ridersWithDistance = onlineRiders
                .filter(r => r.latitude && r.longitude) // Ensure coords exist
                .map(r => ({
                    ...r,
                    distance: haversineDistance(storeLoc.latitude, storeLoc.longitude, r.latitude, r.longitude)
                })).sort((a, b) => a.distance - b.distance);

            const closestRiders = ridersWithDistance.slice(0, 10);

            console.log(`[StoreOrder #${orderId}] Payment Successful. Notifying 10 closest riders:`);
            closestRiders.forEach(r => console.log(` - Rider ${r.name} (${r.distance.toFixed(2)}km away)`));

            // Notify Merchant
            io.to(`merchant_${storeId}`).emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                payment_method: normalizedPayment,
                type: 'store',
                customer_name: customerName,
                customer_phone: customerPhone,
                created_at: new Date(),
                items: items,
                delivery_address: deliveryAddress,
                instructions: instructions || null,
                substitution_preference: substitutionPreference || 'call'
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

            const [onlineRiders] = await db.execute('SELECT id, name, current_latitude as latitude, current_longitude as longitude FROM riders WHERE is_online = 1');

            const ridersWithDistance = onlineRiders
                .filter(r => r.latitude && r.longitude)
                .map(r => ({
                    ...r,
                    distance: haversineDistance(pickup.lat, pickup.lon, r.latitude, r.longitude)
                })).sort((a, b) => a.distance - b.distance);

            const closestRiders = ridersWithDistance.slice(0, 10);

            console.log(`[RideOrder #${orderId}] Booking Request. Notifying 10 closest riders to Pickup Point:`);
            closestRiders.forEach(r => console.log(` - Rider ${r.name} (${r.distance.toFixed(2)}km away)`));

            return sendSuccess(res, { orderId, ridersNotified: closestRiders.length }, "Ride booked successfully");

        } else {
            // === HANDLING RESTAURANT ORDER ===
            if (!restaurantId) return sendError(res, 400, "Restaurant ID required");

            const [restCheck] = await db.execute('SELECT is_available FROM restaurants WHERE id = ?', [restaurantId]);
            if (!restCheck.length || restCheck[0].is_available === 0) {
                return sendError(res, 400, "Restaurant is currently offline/closed.");
            }

            const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
            const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";

            let normalizedPayment = normalizedPaymentMethod;
            if (normalizedPayment === 'cash' || !normalizedPayment) normalizedPayment = 'COD';
            else if (normalizedPayment === 'wallet') normalizedPayment = 'Wallet';
            else if (normalizedPayment === 'coins') normalizedPayment = 'Coins';
            else normalizedPayment = normalizedPayment.toUpperCase();

            const [resOrder] = await db.execute(
                `INSERT INTO orders (user_id, restaurant_id, total_amount, payment_method, status, created_at, instructions, substitution_preference) VALUES (?, ?, ?, ?, 'pending', NOW(), ?, ?)`,
                [userId, restaurantId, total || 0, normalizedPayment, instructions || null, substitutionPreference || 'call']
            );

            const orderId = resOrder.insertId;

            if (normalizedPaymentMethod === 'wallet' || normalizedPaymentMethod === 'coins') {
                try {
                    const payRes = await processCustomerPayment(userId, total, orderId, normalizedPaymentMethod);
                    console.log(`[Payment] Deducted ${total} from user #${userId} ${normalizedPaymentMethod}. Transaction: ${payRes.transactionId}`);
                } catch (payErr) {
                    console.error(`[Payment Error] Post-order debit failed: ${payErr.message}`);
                    return sendError(res, 500, "Payment processing failed. Please contact support.");
                }
            }

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

            io.to(`merchant_${restaurantId}`).emit('new_order', {
                id: orderId,
                status: 'pending',
                total_amount: total,
                payment_method: normalizedPayment,
                type: 'food',
                customer_name: customerName,
                customer_phone: customerPhone,
                created_at: new Date(),
                restaurant_id: restaurantId,
                items: items || [],
                delivery_address: deliveryAddress || 'TBA',
                instructions: instructions || null,
                substitution_preference: substitutionPreference || 'call'
            });

            return sendSuccess(res, { orderId: orderId }, "Food Order placed successfully");
        }
    } catch (err) {
        sendError(res, 500, "Order Creation Failed", "DB_ERROR", err);
    }
};
