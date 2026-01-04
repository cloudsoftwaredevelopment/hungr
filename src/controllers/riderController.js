import { db } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { haversineDistance } from '../utils/geo.js';

const getIO = (req) => req.app.get('io');

export const toggleStatus = async (req, res) => {
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
        console.error("[Status] Update failed:", err);
        sendError(res, 500, "Update failed");
    }
};

export const updateLocation = async (req, res) => {
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
        console.error("[Location] Update failed:", err);
        sendError(res, 500, "Location update failed", "DB_ERROR", err);
    }
};

export const getAvailableOrders = async (req, res) => {
    try {
        const riderId = req.params.id;
        const { lat, lng, maxDistance = 10 } = req.query;

        // Fetch Store Paid Orders that are 'paid' (ready for pickup) and rider_id is NULL
        const [storeOrders] = await db.query(`
            SELECT o.id, o.total_amount as fee, s.name as title, s.address as pickup_location, 
                   s.latitude as pickup_lat, s.longitude as pickup_lng, 'store' as order_type,
                   o.created_at
            FROM store_paid_orders o
            JOIN stores s ON o.store_id = s.id
            WHERE o.status = 'paid' AND o.rider_id IS NULL
            ORDER BY o.created_at DESC
        `);

        // Fetch Food Orders that have dispatch_code (merchant notified riders) - includes preparing AND ready
        const [foodOrders] = await db.query(`
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
};

export const acceptOrder = async (req, res) => {
    try {
        const { id: riderId, orderId } = req.params;
        const { orderType = 'store' } = req.body; // 'food' or 'store'
        const io = getIO(req);

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

        // Store ETA in database so customer app can fetch it
        const updateTable = orderType === 'food' ? 'orders' : 'store_paid_orders';
        await db.execute(`UPDATE ${updateTable} SET delivery_eta_arrival = ? WHERE id = ?`, [etaArrival, orderId]);

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

        // Notify customer via Socket.IO
        const userOrderTable = orderType === 'food' ? 'orders' : 'store_paid_orders';
        const [userRows] = await db.execute(`SELECT user_id FROM ${userOrderTable} WHERE id = ?`, [orderId]);
        if (userRows.length > 0) {
            io.emit(`user_${userRows[0].user_id}_order_update`, {
                orderId: parseInt(orderId),
                status: orderType === 'food' ? 'preparing' : 'assigned',
                riderId: parseInt(riderId),
                delivery_eta_arrival: etaArrival.toISOString(),
                message: 'Rider picking up order and on Queue'
            });
        }

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
};

export const getWalletBalance = async (req, res) => {
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
};

export const completeDelivery = async (req, res) => {
    try {
        const { id: riderId, orderId } = req.params;
        const { orderType } = req.body; // 'food' or 'store'
        const io = getIO(req);

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
            const [orderRows] = await db.execute('SELECT user_id, restaurant_id FROM orders WHERE id = ?', [orderId]);
            if (orderRows.length > 0) {
                const { user_id, restaurant_id } = orderRows[0];
                io.emit(`user_${user_id}_order_update`, {
                    orderId: parseInt(orderId),
                    status: 'delivered',
                    message: 'Your order has been delivered!'
                });

                // Notify Merchant
                io.to(`merchant_${restaurant_id}`).emit('order_delivered', { orderId: parseInt(orderId) });
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

            // Notify customer and Merchant
            const [storeOrderRows] = await db.execute('SELECT user_id, store_id FROM store_paid_orders WHERE id = ?', [orderId]);
            if (storeOrderRows.length > 0) {
                const { user_id, store_id } = storeOrderRows[0];
                io.emit(`user_${user_id}_order_update`, {
                    orderId: parseInt(orderId),
                    status: 'delivered',
                    message: 'Your order has been delivered!'
                });
                io.to(`merchant_${store_id}`).emit('order_delivered', { orderId: parseInt(orderId) });
            }
        }

        console.log(`[Order #${orderId}] Delivery completed by Rider #${riderId}`);
        sendSuccess(res, { orderId, status: 'completed' }, 'Delivery marked as complete');
    } catch (err) {
        console.error('Complete delivery error:', err);
        sendError(res, 500, 'Failed to complete delivery');
    }
};

export const getEarnings = async (req, res) => {
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
};
