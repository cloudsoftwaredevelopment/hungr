import pool from '../config/db.js';
import { emitSocketEvent } from '../services/socketBridge.js';

export async function autoCancelTimeoutOrders() {
    try {
        const timeoutMinutes = 5;

        // 1. Food Orders
        const [foodOrders] = await pool.promise().execute(`
            SELECT id, user_id, restaurant_id 
            FROM orders 
            WHERE status = 'pending' 
            AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [timeoutMinutes]);

        for (const order of foodOrders) {
            await pool.promise().execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
            await pool.promise().execute(
                "INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, 'food', ?)",
                [order.id, 'excessive wait time']
            );

            // Notify Customer
            await emitSocketEvent(null, `user_${order.user_id}_order_update`, {
                orderId: parseInt(order.id),
                status: 'cancelled',
                message: 'Order cancelled: excessive wait time (merchant busy)'
            });

            // Notify Merchant
            await emitSocketEvent(`merchant_${order.restaurant_id}`, 'order_cancelled', {
                orderId: parseInt(order.id),
                reason: 'excessive wait time'
            });

            console.log(`[Worker] Food Order #${order.id} cancelled due to timeout.`);
        }

        // 2. Store Orders
        const [storeOrders] = await pool.promise().execute(`
            SELECT id, user_id, store_id 
            FROM store_paid_orders 
            WHERE status = 'pending' 
            AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [timeoutMinutes]);

        for (const order of storeOrders) {
            await pool.promise().execute("UPDATE store_paid_orders SET status = 'cancelled' WHERE id = ?", [order.id]);
            await pool.promise().execute(
                "INSERT INTO declined_orders (order_id, order_type, reason) VALUES (?, 'store', ?)",
                [order.id, 'excessive wait time']
            );

            // Notify Customer
            await emitSocketEvent(null, `user_${order.user_id}_order_update`, {
                orderId: parseInt(order.id),
                status: 'cancelled',
                message: 'Order cancelled: excessive wait time (store busy)'
            });

            // Notify Merchant
            await emitSocketEvent(`merchant_${order.store_id}`, 'order_cancelled', {
                orderId: parseInt(order.id),
                reason: 'excessive wait time'
            });

            console.log(`[Worker] Store Order #${order.id} cancelled due to timeout.`);
        }

    } catch (err) {
        console.error("[Worker] Auto-cancel timeout error:", err);
    }
}
