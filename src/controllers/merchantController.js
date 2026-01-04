import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { generateToken } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { haversineDistance } from '../utils/geo.js';
import { createRefundRequest } from '../services/refundService.js';
import { NOTIFICATION_RADIUS_TIERS, NOTIFICATION_EXPANSION_MINUTES } from '../config/constants.js';

const getIO = (req) => req.app.get('io');

// Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const [results] = await db.query('SELECT * FROM merchants WHERE email = ?', [email]);

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
            mustChangePassword: merchant.must_change_password === 1,
            accessToken: token
        });
    } catch (err) {
        sendError(res, 500, "Login failed", "AUTH_ERROR", err);
    }
};

// Change merchant password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const merchantId = req.user.id;

        if (!newPassword || newPassword.length < 8) {
            return sendError(res, 400, 'New password must be at least 8 characters');
        }

        // Get current merchant
        const [merchants] = await db.execute('SELECT password_hash FROM merchants WHERE id = ?', [merchantId]);
        if (merchants.length === 0) {
            return sendError(res, 404, 'Merchant not found');
        }

        // Verify current password (skip if this is a forced change - currentPassword can be empty)
        if (currentPassword) {
            const valid = await bcrypt.compare(currentPassword, merchants[0].password_hash);
            if (!valid) {
                return sendError(res, 401, 'Current password is incorrect');
            }
        }

        // Hash new password and update
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE merchants SET password_hash = ?, must_change_password = 0 WHERE id = ?', [newPasswordHash, merchantId]);

        console.log(`[Merchant #${merchantId}] Password changed successfully`);
        sendSuccess(res, { success: true }, 'Password changed successfully');
    } catch (err) {
        console.error('Change password error:', err);
        sendError(res, 500, 'Failed to change password');
    }
};

// Update Status (Online/Offline)
export const updateStatus = async (req, res) => {
    try {
        const { isOnline } = req.body;
        const restaurantId = req.user.restaurantId;
        const io = getIO(req);

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
};

// Update Merchant Location
export const updateLocation = async (req, res) => {
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
};

// Get Orders (Food & Store)
export const getOrders = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if ((role !== 'merchant' && role !== 'store_admin') || !restaurantId) return sendError(res, 403, 'Access denied');

        let orders = [];

        try {
            const storeQuery = `
                SELECT o.id, o.total_amount, o.payment_method, o.status, o.created_at, 
                u.username as customer_name, 
                u.phone_number as customer_phone,
                o.delivery_address,
                o.instructions,
                o.substitution_preference,
                JSON_ARRAYAGG(
                    JSON_OBJECT('name', i.product_name, 'quantity', i.quantity, 'price', i.price, 'preparation_time_min', 0, 'preparation_time_sec', 0)
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
            SELECT o.id, o.total_amount, o.payment_method, o.status, o.created_at, o.dispatch_code, o.rider_id,
            u.username as customer_name,
            u.address as delivery_address, 
            o.instructions, 
            u.phone_number as customer_phone,
            o.substitution_preference,
            JSON_ARRAYAGG(
                JSON_OBJECT('id', oi.id, 'name', m.name, 'quantity', oi.quantity, 'price', oi.price_at_time, 'preparation_time_min', m.preparation_time_min, 'preparation_time_sec', m.preparation_time_sec)
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

        const [restRows] = await db.query(restQuery, [restaurantId]);

        const restOrders = Array.isArray(restRows) ? restRows.map(row => ({
            ...row,
            items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
            type: 'food'
        })) : [];

        sendSuccess(res, [...orders, ...restOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

    } catch (err) {
        sendError(res, 500, 'DB Error', 'DB_ERROR', err);
    }
};

// Get nearby riders
export const getNearbyRiders = async (req, res) => {
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
};

// Verify Rider Code
export const verifyRider = async (req, res) => {
    try {
        const { restaurantId } = req.user;
        const { orderId, riderIdCode, orderType } = req.body;
        const io = getIO(req);

        const table = orderType === 'store' ? 'store_paid_orders' : 'orders';
        const storeTable = orderType === 'store' ? 'stores' : 'restaurants';
        const storeCol = orderType === 'store' ? 'store_id' : 'restaurant_id';

        const [rows] = await db.execute(`
            SELECT o.rider_id, o.user_id, 
                   u.latitude as customer_lat, u.longitude as customer_lng,
                   s.latitude as merchant_lat, s.longitude as merchant_lng
            FROM ${table} o
            JOIN users u ON o.user_id = u.id
            JOIN ${storeTable} s ON o.${storeCol} = s.id
            WHERE o.id = ? AND o.${storeCol} = ?
        `, [orderId, restaurantId]);

        if (rows.length === 0) return sendError(res, 404, "Order not found");

        const order = rows[0];
        const assignedRiderId = order.rider_id;

        if (!assignedRiderId) return sendError(res, 400, "No rider assigned yet");

        if (parseInt(assignedRiderId) === parseInt(riderIdCode)) {
            // Calculate Delivery ETA
            let deliveryEtaMinutes = 15;
            if (order.merchant_lat && order.merchant_lng && order.customer_lat && order.customer_lng) {
                const distance = haversineDistance(
                    parseFloat(order.merchant_lat), parseFloat(order.merchant_lng),
                    parseFloat(order.customer_lat), parseFloat(order.customer_lng)
                );
                deliveryEtaMinutes = Math.ceil(distance / 0.25);
                if (deliveryEtaMinutes < 5) deliveryEtaMinutes = 5;
                if (deliveryEtaMinutes > 90) deliveryEtaMinutes = 90;
            }
            const deliveryEtaArrival = new Date(Date.now() + deliveryEtaMinutes * 60 * 1000);

            // Success! Update status to 'delivering'
            await db.execute(`UPDATE ${table} SET status = 'delivering', delivery_eta_arrival = ? WHERE id = ?`, [deliveryEtaArrival, orderId]);

            // Notify customer via Socket.IO
            io.emit(`user_${order.user_id}_order_update`, {
                orderId: parseInt(orderId),
                status: 'delivering',
                message: 'Rider on the way to deliver',
                delivery_eta_arrival: deliveryEtaArrival.toISOString()
            });

            // Notify Merchant to clear from their active board
            io.to(`merchant_${restaurantId}`).emit('order_delivered', { orderId: parseInt(orderId) });

            sendSuccess(res, { verified: true }, "Rider Verified. Order handed over.");
        } else {
            sendError(res, 401, "Invalid Rider ID. Verification failed.");
        }
    } catch (err) {
        console.error("Verify Rider Error:", err);
        sendError(res, 500, "Verification failed", "DB_ERROR", err);
    }
};

// Update Order Status
export const updateOrderStatus = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { status, type, reason } = req.body;
        const io = getIO(req);

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const table = type === 'store' ? 'store_paid_orders' : 'orders';
        const storeCol = type === 'store' ? 'store_id' : 'restaurant_id';

        // Use execute for updates
        const [result] = await db.execute(`UPDATE ${table} SET status = ? WHERE id = ? AND ${storeCol} = ?`, [status, orderId, restaurantId]);

        if (result.affectedRows === 0) return sendError(res, 404, 'Order not found');

        if (status === 'cancelled') {
            await db.execute('INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, ?, ?)', [orderId, type || 'food', reason || 'Order Declined']);

            // NEW: Automatic Refund Request for Wallet/Coins
            const [orderRows] = await db.execute(`SELECT user_id, total_amount, payment_method FROM ${table} WHERE id = ?`, [orderId]);
            if (orderRows.length > 0) {
                const order = orderRows[0];

                // Fetch merchant phone for admin contact
                const [merchantRows] = await db.execute('SELECT phone_number FROM merchants WHERE restaurant_id = ?', [restaurantId]);
                const merchantPhone = merchantRows[0]?.phone_number || 'N/A';

                await createRefundRequest(db, order.user_id, order.total_amount, order.payment_method, orderId, reason, merchantPhone);

                // Notify customer via Socket.IO
                io.emit(`user_${order.user_id}_order_update`, {
                    orderId: parseInt(orderId),
                    status: 'cancelled',
                    message: 'Your order was declined by the merchant: ' + (reason || 'No reason provided')
                });
            }
        }

        // If status is 'preparing' (accept), insert into prepared_orders and notify riders
        if (status === 'preparing') {
            await db.execute('INSERT INTO prepared_orders (order_id, order_type, restaurant_id) VALUES (?, ?, ?)', [orderId, type || 'food', restaurantId]);

            // Notify customer via Socket.IO
            const [userRows] = await db.execute(`SELECT user_id FROM ${table} WHERE id = ?`, [orderId]);
            if (userRows.length > 0) {
                io.emit(`user_${userRows[0].user_id}_order_update`, {
                    orderId: parseInt(orderId),
                    status: 'preparing',
                    message: 'Your order is being prepared'
                });
            }

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
                        orderId: parseInt(orderId),
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
                            orderId: parseInt(orderId),
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
                            orderId: parseInt(orderId),
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
                        orderId: parseInt(orderId),
                        restaurantName: restName,
                        restaurantAddress: restAddress,
                        totalAmount: parseFloat(totalAmount).toFixed(2),
                        dispatchCode,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`[Order #${orderId}] Marked Ready. Auto-generated Dispatch Code: ${dispatchCode}. Notified ${closestRiders.length} riders.`);
                }
            }

            // Notify customer via Socket.IO with ETA if available
            const [userRows] = await db.execute(`SELECT user_id, delivery_eta_arrival FROM ${table} WHERE id = ?`, [orderId]);
            if (userRows.length > 0) {
                io.emit(`user_${userRows[0].user_id}_order_update`, {
                    orderId: parseInt(orderId),
                    status: 'ready_for_pickup',
                    message: 'Order is Ready! Waiting for rider to pick up.',
                    delivery_eta_arrival: userRows[0].delivery_eta_arrival ? userRows[0].delivery_eta_arrival : null
                });
            }
        }

        sendSuccess(res, { id: orderId, status }, 'Status updated');
    } catch (err) {
        console.error("Order status update error:", err);
        sendError(res, 500, 'Update failed');
    }
};

// Notify Closest Riders
export const notifyRiders = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { type } = req.body;
        const io = getIO(req);

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

        // Notify Customer about the dispatch code via Socket.IO
        const [userQuery] = await db.execute('SELECT user_id FROM orders WHERE id = ?', [orderId]);
        if (userQuery.length > 0) {
            io.emit(`user_${userQuery[0].user_id}_order_update`, {
                orderId: parseInt(orderId),
                status: 'assigned', // Keep as assigned or current status, but include dispatch code
                dispatch_code: dispatchCode,
                message: `Dispatch Code Generated: ${dispatchCode}. Notifying nearby riders.`
            });
        }

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
                orderId: parseInt(orderId),
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
};

// Find orders by dispatch code
export const findByDispatchCode = async (req, res) => {
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
};

// Marketing Stats
export const getMarketingStats = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const [results] = await db.execute(`
            SELECT commission_rate, join_date, name
            FROM restaurants 
            WHERE id = ?
        `, [restaurantId]);

        if (results.length === 0) return sendError(res, 404, 'Restaurant not found');

        const restaurant = results[0];

        // Calculate months since joining
        const joinDate = new Date(restaurant.join_date);
        const now = new Date();
        const monthsJoined = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());

        // Dummy stats for total saved vs competitors
        const [orderStats] = await db.execute(`
            SELECT COUNT(*) as total_orders, SUM(total_amount) as total_sales
            FROM orders 
            WHERE restaurant_id = ? AND status = 'completed'
        `, [restaurantId]);

        const sales = parseFloat(orderStats[0].total_sales || 0);
        const hungrCommission = sales * (parseFloat(restaurant.commission_rate) / 100);
        const competitorAvgCommission = sales * 0.25; // Assuming 25% avg
        const totalSaved = competitorAvgCommission - hungrCommission;

        sendSuccess(res, {
            commissionRate: restaurant.commission_rate,
            joinDate: restaurant.join_date,
            monthsJoined,
            completedOrders: orderStats[0].total_orders,
            totalSales: sales.toFixed(2),
            totalSaved: Math.max(0, totalSaved).toFixed(2),
            isNewMerchantPromo: monthsJoined < 6
        });
    } catch (err) {
        console.error("Marketing stats error:", err);
        sendError(res, 500, 'Failed to fetch marketing stats');
    }
};

// Get Campaigns
export const getCampaigns = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const [campaigns] = await db.execute(`
            SELECT * FROM merchant_campaigns 
            WHERE restaurant_id = ? 
            ORDER BY created_at DESC
        `, [restaurantId]);

        sendSuccess(res, campaigns);
    } catch (err) {
        console.error("Fetch campaigns error:", err);
        sendError(res, 500, 'Failed to fetch campaigns');
    }
};

// Save Campaign
export const saveCampaign = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const { id, name, discountPercentage, isCoFunded, isActive, startDate, endDate } = req.body;

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        if (id) {
            // Update
            await db.execute(`
                UPDATE merchant_campaigns 
                SET name = ?, discount_percentage = ?, is_co_funded = ?, is_active = ?, start_date = ?, end_date = ?
                WHERE id = ? AND restaurant_id = ?
            `, [name, discountPercentage, isCoFunded ? 1 : 0, isActive ? 1 : 0, startDate || null, endDate || null, id, restaurantId]);
            sendSuccess(res, { id }, 'Campaign updated');
        } else {
            // Create
            const [result] = await db.execute(`
                INSERT INTO merchant_campaigns (restaurant_id, name, discount_percentage, is_co_funded, is_active, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [restaurantId, name, discountPercentage, isCoFunded ? 1 : 0, isActive ? 1 : 0, startDate || null, endDate || null]);
            sendSuccess(res, { id: result.insertId }, 'Campaign created');
        }
    } catch (err) {
        console.error("Save campaign error:", err);
        sendError(res, 500, 'Failed to save campaign');
    }
};

// Unassign Rider (Resubmit)
export const unassignRider = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { type = 'food' } = req.body;
        const io = getIO(req);

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const table = type === 'store' ? 'store_paid_orders' : 'orders';
        const storeTable = type === 'store' ? 'stores' : 'restaurants';
        const storeCol = type === 'store' ? 'store_id' : 'restaurant_id';

        // 1. Verify ownership and get current state
        const [rows] = await db.execute(`
            SELECT o.id, o.rider_id, o.total_amount, o.dispatch_code,
                   s.latitude, s.longitude, s.name as store_name, s.address as store_address,
                   o.user_id
            FROM ${table} o
            JOIN ${storeTable} s ON o.${storeCol} = s.id
            WHERE o.id = ? AND o.${storeCol} = ?
        `, [orderId, restaurantId]);

        if (rows.length === 0) return sendError(res, 404, 'Order not found');
        const order = rows[0];

        const oldRiderId = order.rider_id;
        if (!oldRiderId) return sendError(res, 400, 'No rider assigned to this order');

        // 2. Unassign Rider
        // RESET: rider_id, delivery_eta_arrival, notification_started_at, notification_radius
        await db.execute(`
            UPDATE ${table} 
            SET rider_id = NULL, 
                delivery_eta_arrival = NULL, 
                notification_started_at = NOW(), 
                notification_radius = ?
            WHERE id = ?
        `, [NOTIFICATION_RADIUS_TIERS[0], orderId]);

        // 3. Notify original rider that they are unassigned
        io.emit(`rider_${oldRiderId}_unassigned`, {
            orderId: parseInt(orderId),
            message: 'You have been unassigned from this order by the merchant.'
        });

        // Also emit to the dedicated room if they are using it
        io.to(`rider_${oldRiderId}`).emit('order_unassigned', {
            orderId: parseInt(orderId),
            message: 'You have been unassigned from this order by the merchant.'
        });

        // 4. Re-broadcast to nearby riders
        const restLat = parseFloat(order.latitude);
        const restLon = parseFloat(order.longitude);

        const [onlineRiders] = await db.execute('SELECT id, user_id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

        if (onlineRiders.length > 0) {
            const ridersWithDistance = onlineRiders.map(r => ({
                ...r,
                distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
            })).sort((a, b) => a.distance - b.distance);

            const initialRadius = NOTIFICATION_RADIUS_TIERS[0];
            const closestRiders = ridersWithDistance
                .filter(r => r.distance <= initialRadius)
                .slice(0, 10);

            closestRiders.forEach(rider => {
                io.to(`rider_${rider.id}`).emit('new_order', {
                    orderId: parseInt(orderId),
                    orderType: type,
                    restaurantId,
                    restaurantName: order.store_name,
                    restaurantAddress: order.store_address,
                    totalAmount: parseFloat(order.total_amount).toFixed(2),
                    dispatchCode: order.dispatch_code,
                    message: `[RESUBMIT] Pickup at ${order.store_name} - ₱${parseFloat(order.total_amount).toFixed(2)}`,
                    estimatedDistance: rider.distance.toFixed(2)
                });
            });
        }

        // 5. Notify customer
        io.emit(`user_${order.user_id}_order_update`, {
            orderId: parseInt(orderId),
            status: 'searching_rider',
            message: 'We are finding a new rider for your order.'
        });

        console.log(`[Order #${orderId}] Resubmitted by Merchant. Rider #${oldRiderId} unassigned.`);
        sendSuccess(res, null, "Order resubmitted for other riders.");
    } catch (err) {
        console.error("Unassign error:", err);
        sendError(res, 500, 'Failed to resubmit order');
    }
};

// Release Order
export const releaseOrder = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { riderId } = req.body;
        const io = getIO(req);

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        // Verify order belongs to restaurant and get customer info + restaurant location
        const [orderRows] = await db.execute(`
            SELECT o.id, o.user_id, o.dispatch_code, o.total_amount, o.rider_id,
                   u.username as customer_name, u.phone_number as customer_phone,
                   u.address as customer_address, u.latitude as customer_lat, u.longitude as customer_lng,
                   r.latitude as merchant_lat, r.longitude as merchant_lng
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.id = ? AND o.restaurant_id = ?
        `, [orderId, restaurantId]);

        if (orderRows.length === 0) return sendError(res, 404, 'Order not found');

        const order = orderRows[0];
        const effectiveRiderId = riderId || order.rider_id;

        // Calculate Delivery ETA (Merchant to Customer)
        let deliveryEtaMinutes = 15; // default 15 mins for delivery
        if (order.merchant_lat && order.merchant_lng && order.customer_lat && order.customer_lng) {
            const distance = haversineDistance(
                parseFloat(order.merchant_lat), parseFloat(order.merchant_lng),
                parseFloat(order.customer_lat), parseFloat(order.customer_lng)
            );
            deliveryEtaMinutes = Math.ceil(distance / 0.25);
            if (deliveryEtaMinutes < 5) deliveryEtaMinutes = 5;
            if (deliveryEtaMinutes > 90) deliveryEtaMinutes = 90;
        }
        const deliveryEtaArrival = new Date(Date.now() + deliveryEtaMinutes * 60 * 1000);

        // Update order status to delivering
        await db.execute(`
            UPDATE orders 
            SET status = 'delivering', delivery_eta_arrival = ?, updated_at = NOW()
            WHERE id = ?
        `, [deliveryEtaArrival, orderId]);

        // Clear dispatch code after release
        await db.execute('UPDATE orders SET dispatch_code = NULL WHERE id = ?', [orderId]);

        // Notify customer via Socket.IO
        io.emit(`user_${order.user_id}_order_update`, {
            orderId,
            status: 'delivering',
            message: 'Rider on the way to deliver',
            delivery_eta_arrival: deliveryEtaArrival.toISOString()
        });

        // Notify Merchant to clear from their active board
        io.to(`merchant_${restaurantId}`).emit('order_delivered', { orderId: parseInt(orderId) });

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
};

// Process Batch
export const processBatch = async (req, res) => {
    try {
        const { restaurantId, role } = req.user;
        const orderId = req.params.id;
        const { type, declinedItems, acceptedItems, fullDecline = false, reason = 'Order Declined' } = req.body;
        const io = getIO(req);

        if (role !== 'merchant') return sendError(res, 403, 'Access denied');

        const orderTable = type === 'store' ? 'store_paid_orders' : 'orders';
        const itemTable = type === 'store' ? 'store_order_items' : 'order_items';
        const storeCol = type === 'store' ? 'store_id' : 'restaurant_id';

        // 1. Verify Order Ownership
        const [orderCheck] = await db.execute(`SELECT id, total_amount, user_id, payment_method FROM ${orderTable} WHERE id = ? AND ${storeCol} = ?`, [orderId, restaurantId]);
        if (orderCheck.length === 0) return sendError(res, 404, 'Order not found');
        const order = orderCheck[0];

        // 2. Handle Full Decline
        if (fullDecline) {
            await db.execute(`UPDATE ${orderTable} SET status = 'cancelled' WHERE id = ?`, [orderId]);
            await db.execute(
                `INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, ?, ?)`,
                [orderId, type || 'food', reason]
            );

            // Notify user
            io.emit(`user_${order.user_id}_order_update`, {
                orderId: parseInt(orderId),
                status: 'cancelled',
                message: 'Your order was declined by the merchant: ' + reason
            });

            // Fetch merchant phone for admin contact
            const [merchantRows] = await db.execute('SELECT phone_number FROM merchants WHERE restaurant_id = ?', [restaurantId]);
            const merchantPhone = merchantRows[0]?.phone_number || 'N/A';

            // NEW: Automatic Refund Request
            await createRefundRequest(db, order.user_id, order.total_amount, order.payment_method, orderId, reason, merchantPhone);

            return sendSuccess(res, { id: orderId, status: 'cancelled' }, "Order fully declined");
        }

        // 3. Process Declined Items
        if (declinedItems && declinedItems.length > 0) {
            for (const item of declinedItems) {
                await db.execute(
                    `INSERT INTO declined_orders (order_id, order_type, item_name, quantity, reason) VALUES (?, ?, ?, ?, ?)`,
                    [orderId, type || 'food', item.name, item.quantity, item.reason]
                );
                await db.execute(`DELETE FROM ${itemTable} WHERE id = ?`, [item.id]);
            }
        }

        // 4. Recalculate Total
        const priceCol = type === 'store' ? 'price' : 'price_at_time';
        let newTotal = 0;
        const [remainingItems] = await db.execute(`SELECT quantity, ${priceCol} as price FROM ${itemTable} WHERE order_id = ?`, [orderId]);

        remainingItems.forEach(i => {
            newTotal += (parseFloat(i.price) * i.quantity);
        });

        // 5. Update Order
        let newStatus = 'preparing';
        if (remainingItems.length === 0) {
            newStatus = 'cancelled';
        }

        await db.execute(`UPDATE ${orderTable} SET total_amount = ?, status = ? WHERE id = ?`, [newTotal, newStatus, orderId]);

        // NEW: Partial Refund for Wallet/Coins
        if (newTotal < order.total_amount) {
            const refundAmount = order.total_amount - newTotal;

            // Fetch merchant phone for admin contact
            const [merchantRows] = await db.execute('SELECT phone_number FROM merchants WHERE restaurant_id = ?', [restaurantId]);
            const merchantPhone = merchantRows[0]?.phone_number || 'N/A';

            await createRefundRequest(db, order.user_id, refundAmount, order.payment_method, orderId, `Partial items declined. Original: ${order.total_amount}, New: ${newTotal}`, merchantPhone);
        }

        if (newStatus === 'cancelled') {
            await db.execute(`INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, ?, 'All items declined')`, [orderId, type || 'food']);
        } else {
            // If some items remain, it's effectively accepted but partial
            await db.execute('INSERT INTO prepared_orders (order_id, order_type, restaurant_id) VALUES (?, ?, ?)', [orderId, type || 'food', restaurantId]);
        }

        // Notify customer via Socket.IO
        io.emit(`user_${order.user_id}_order_update`, {
            orderId: parseInt(orderId),
            status: newStatus,
            message: newStatus === 'cancelled' ? 'Your order was fully declined' : 'Your order is being prepared (some items unavailable)'
        });

        sendSuccess(res, { id: orderId, status: newStatus, newTotal, remainingCount: remainingItems.length }, "Order processed");

    } catch (err) {
        console.error("Batch Process Error", err);
        sendError(res, 500, "Processing failed", "DB_ERROR", err);
    }
};

// Update Profile
export const updateProfile = async (req, res) => {
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
};

// Get Menu
export const getMenu = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name', [req.user.restaurantId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
};

// Save Menu Item
export const saveMenuItem = async (req, res) => {
    try {
        const { id, restaurant_id, name, description, price, cost, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end, preparation_time_min, preparation_time_sec } = req.body;
        if (req.user.restaurantId !== restaurant_id) return sendError(res, 403, "Unauthorized");

        const sql = id
            ? `UPDATE menu_items SET name=?, description=?, price=?, cost=?, promotional_price=?, category=?, image_url=?, stock_quantity=?, is_available=?, food_type=?, cuisine_type=?, availability_start=?, availability_end=?, preparation_time_min=?, preparation_time_sec=? WHERE id=? AND restaurant_id=?`
            : `INSERT INTO menu_items (name, description, price, cost, promotional_price, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start, availability_end, preparation_time_min, preparation_time_sec, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = id
            ? [name, description, price, cost || 0, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, preparation_time_min || 0, preparation_time_sec || 0, id, restaurant_id]
            : [name, description, price, cost || 0, promotional_price || null, category, image_url, stock_quantity, is_available, food_type, cuisine_type, availability_start || null, availability_end || null, preparation_time_min || 0, preparation_time_sec || 0, restaurant_id];

        const [result] = await db.query(sql, params);
        sendSuccess(res, { id: id || result.insertId }, "Item saved");
    } catch (err) {
        sendError(res, 500, "Save failed", "DB_ERROR", err);
    }
};

// Delete Menu Item
export const deleteMenuItem = async (req, res) => {
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
};

// Upload Image (Handler only, middleware is in route)
export const uploadImage = (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'No image file uploaded');
        }

        // Construct the public URL for the uploaded image
        const imageUrl = `/hungr/uploads/menu/${req.file.filename}`;

        console.log(`[Upload] Image uploaded: ${req.file.filename} for restaurant ${req.user.restaurantId}`);
        sendSuccess(res, { imageUrl }, 'Image uploaded successfully');
    } catch (err) {
        console.error('Upload Error:', err);
        sendError(res, 500, 'Image upload failed');
    }
};

// Sales History
export const getSalesHistory = async (req, res) => {
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
              AND o.status IN ('preparing', 'ready_for_pickup', 'delivering', 'delivered')
              ${dateFilter}
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 1000
        `;

        const [salesRows] = await db.query(salesQuery, params);

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
};

// Get Discounts/Promos
export const getDiscounts = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM restaurant_discounts WHERE restaurant_id = ?', [req.user.restaurantId]);
        sendSuccess(res, results);
    } catch (err) {
        sendError(res, 500, 'DB Error');
    }
};

// Save Discount
export const saveDiscount = async (req, res) => {
    try {
        const { id, name, type, value, min_order_amount, start_date, end_date, is_active } = req.body;
        const restaurant_id = req.user.restaurantId;

        const sql = id
            ? `UPDATE restaurant_discounts SET name=?, type=?, value=?, min_order_amount=?, start_date=?, end_date=?, is_active=? WHERE id=? AND restaurant_id=?`
            : `INSERT INTO restaurant_discounts (name, type, value, min_order_amount, start_date, end_date, is_active, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = id
            ? [name, type, value, min_order_amount || 0, start_date, end_date, is_active ? 1 : 0, id, restaurant_id]
            : [name, type, value, min_order_amount || 0, start_date, end_date, is_active ? 1 : 0, restaurant_id];

        const [result] = await db.query(sql, params);
        sendSuccess(res, { id: id || result.insertId }, "Discount saved");
    } catch (err) {
        sendError(res, 500, "Save failed", "DB_ERROR", err);
    }
};

// Delete Discount
export const deleteDiscount = async (req, res) => {
    try {
        await db.query('DELETE FROM restaurant_discounts WHERE id = ? AND restaurant_id = ?', [req.params.id, req.user.restaurantId]);
        sendSuccess(res, null, "Discount deleted");
    } catch (err) {
        sendError(res, 500, "Delete failed", "DB_ERROR", err);
    }
};
