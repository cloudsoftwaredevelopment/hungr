import { db } from '../config/db.js';
import { haversineDistance } from '../utils/geo.js';
import { processCustomerPayment, getCustomerBalance } from '../routes/walletRoutes.js';

export const OrderService = {
    async createPabiliOrder(userId, dto) {
        const { store_id, items, estimated_cost, delivery_address } = dto;

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

        // Find Riders
        const [riders] = await db.query(`
            SELECT r.id, r.name, w.balance 
            FROM riders r 
            JOIN wallets w ON r.user_id = w.user_id 
            WHERE r.is_online = 1 AND w.balance >= ? 
            LIMIT 10
        `, [estimated_cost]);

        return { orderId: pabiliId, riders };
    },

    async cancelPabiliOrder(orderId, rider_id, reason) {
        await db.execute(
            `INSERT INTO cancelled_orders (order_id, order_type, rider_id, reason) VALUES (?, 'pabili', ?, ?)`,
            [orderId, rider_id, reason || 'Rider cancelled']
        );

        await db.execute(
            `UPDATE pabili_orders SET status = 'pending', rider_id = NULL WHERE id = ?`,
            [orderId]
        );
    },

    // Main Place Order Logic
    async placeOrder(userId, userDetails, dto, io) {
        const { restaurantId, storeId, orderType, items, total, paymentMethod, instructions, substitutionPreference } = dto;
        const customerName = userDetails.username || 'Customer';
        const customerPhone = userDetails.phone_number || 'N/A';

        // 1. Balance Check
        const normalizedPaymentMethod = (paymentMethod || '').toLowerCase();
        let finalPaymentMethod = normalizedPaymentMethod;

        if (normalizedPaymentMethod === 'cash' || !normalizedPaymentMethod) finalPaymentMethod = 'COD';
        else if (normalizedPaymentMethod === 'wallet') finalPaymentMethod = 'Wallet';
        else if (normalizedPaymentMethod === 'coins') finalPaymentMethod = 'Coins';
        else finalPaymentMethod = normalizedPaymentMethod.toUpperCase();

        if (normalizedPaymentMethod === 'wallet' || normalizedPaymentMethod === 'coins') {
            const balance = await getCustomerBalance(userId, normalizedPaymentMethod);
            const amountToDeduct = parseFloat(total);

            if (isNaN(amountToDeduct) || amountToDeduct <= 0) {
                throw new Error("Invalid order total amount");
            }
            if (balance < amountToDeduct) {
                const err = new Error(`Insufficient ${normalizedPaymentMethod} balance. Required: ₱${amountToDeduct}, Available: ₱${balance}`);
                err.code = 'INSUFFICIENT_FUNDS';
                throw err;
            }
        }

        // 2. Branch by Order Type
        if (orderType === 'store' && storeId) {
            return await this._createStoreOrder(userId, storeId, total, finalPaymentMethod, instructions, substitutionPreference, items, normalizedPaymentMethod, customerName, customerPhone, io);
        } else if (orderType === 'ride') {
            return await this._createRideOrder(userId, dto, io);
        } else {
            return await this._createRestaurantOrder(userId, restaurantId, total, finalPaymentMethod, instructions, substitutionPreference, items, normalizedPaymentMethod, customerName, customerPhone, io);
        }
    },

    // Private helpers
    async _createStoreOrder(userId, storeId, total, paymentMethod, instructions, substitutionPreference, items, originalPaymentMethod, customerName, customerPhone, io) {
        const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
        const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";

        const [orderResult] = await db.execute(
            `INSERT INTO store_paid_orders (user_id, store_id, total_amount, payment_method, delivery_address, status, instructions, substitution_preference) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
            [userId, storeId, total, paymentMethod, deliveryAddress, instructions || null, substitutionPreference || 'call']
        );
        const orderId = orderResult.insertId;

        // Debit
        if (originalPaymentMethod === 'wallet' || originalPaymentMethod === 'coins') {
            await processCustomerPayment(userId, total, orderId, originalPaymentMethod);
        }

        // Save Items
        if (items && items.length > 0) {
            const itemValues = items.map(i => [orderId, i.id, i.name, i.quantity, i.price || 0]);
            await db.query('INSERT INTO store_order_items (order_id, product_id, product_name, quantity, price) VALUES ?', [itemValues]);
        }

        // Notify Riders
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

        // Notify Merchant
        io.to(`merchant_${storeId}`).emit('new_order', {
            id: orderId,
            status: 'pending',
            total_amount: total,
            payment_method: paymentMethod,
            type: 'store',
            customer_name: customerName,
            customer_phone: customerPhone,
            created_at: new Date(),
            items: items,
            delivery_address: deliveryAddress,
            instructions: instructions || null,
            substitution_preference: substitutionPreference || 'call'
        });

        return { orderId, ridersNotified: closestRiders.length };
    },

    async _createRideOrder(userId, dto, io) {
        const { pickup, dropoff, fare, distance } = dto;

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

        return { orderId, ridersNotified: closestRiders.length };
    },

    async _createRestaurantOrder(userId, restaurantId, total, paymentMethod, instructions, substitutionPreference, items, originalPaymentMethod, customerName, customerPhone, io) {
        if (!restaurantId) throw new Error("Restaurant ID required");

        const [restCheck] = await db.execute('SELECT is_available FROM restaurants WHERE id = ?', [restaurantId]);
        if (!restCheck.length || restCheck[0].is_available === 0) {
            throw new Error("Restaurant is currently offline/closed.");
        }

        const [addrRows] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1', [userId]);
        const deliveryAddress = addrRows.length > 0 ? addrRows[0].address : "User Location";

        const [resOrder] = await db.execute(
            `INSERT INTO orders (user_id, restaurant_id, total_amount, payment_method, status, created_at, instructions, substitution_preference) VALUES (?, ?, ?, ?, 'pending', NOW(), ?, ?)`,
            [userId, restaurantId, total || 0, paymentMethod, instructions || null, substitutionPreference || 'call']
        );

        const orderId = resOrder.insertId;

        if (originalPaymentMethod === 'wallet' || originalPaymentMethod === 'coins') {
            await processCustomerPayment(userId, total, orderId, originalPaymentMethod);
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
            payment_method: paymentMethod,
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

        return { orderId };
    }
};
