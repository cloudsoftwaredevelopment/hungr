import pool from '../config/db.js';
import { emitSocketEvent } from '../services/socketBridge.js';
import { NOTIFICATION_RADIUS_TIERS, NOTIFICATION_EXPANSION_MINUTES } from '../config/constants.js';

// Haversine formula
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function expandNotificationRadius() {
    try {
        const [ordersNeedingExpansion] = await pool.promise().execute(`
            SELECT o.id, o.restaurant_id, o.total_amount, o.notification_radius, o.notification_started_at,
                   r.latitude, r.longitude, r.name as restaurant_name, r.address as restaurant_address
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.rider_id IS NULL 
              AND o.dispatch_code IS NOT NULL
              AND o.notification_started_at IS NOT NULL
              AND o.status IN ('preparing', 'ready_for_pickup')
              AND TIMESTAMPDIFF(MINUTE, o.notification_started_at, NOW()) >= ?
              AND o.notification_radius < ?
        `, [NOTIFICATION_EXPANSION_MINUTES, Math.max(...NOTIFICATION_RADIUS_TIERS)]);

        for (const order of ordersNeedingExpansion) {
            const currentRadius = order.notification_radius || NOTIFICATION_RADIUS_TIERS[0];
            const currentTierIndex = NOTIFICATION_RADIUS_TIERS.indexOf(currentRadius);

            if (currentTierIndex >= NOTIFICATION_RADIUS_TIERS.length - 1) continue;

            const minutesSinceStart = Math.floor((Date.now() - new Date(order.notification_started_at).getTime()) / 60000);
            const expectedTierIndex = Math.min(
                Math.floor(minutesSinceStart / NOTIFICATION_EXPANSION_MINUTES),
                NOTIFICATION_RADIUS_TIERS.length - 1
            );

            if (expectedTierIndex <= currentTierIndex) continue;

            const newRadius = NOTIFICATION_RADIUS_TIERS[expectedTierIndex];

            // Update DB
            await pool.promise().execute('UPDATE orders SET notification_radius = ? WHERE id = ?', [newRadius, order.id]);

            // Find online riders
            const [onlineRiders] = await pool.promise().execute('SELECT id, name, current_latitude, current_longitude FROM riders WHERE is_online = 1 AND current_latitude IS NOT NULL');

            if (onlineRiders.length === 0) continue;

            const restLat = parseFloat(order.latitude);
            const restLon = parseFloat(order.longitude);

            // Filter new riders
            const newRiders = onlineRiders
                .map(r => ({
                    ...r,
                    distance: haversineDistance(restLat, restLon, parseFloat(r.current_latitude), parseFloat(r.current_longitude))
                }))
                .filter(r => r.distance <= newRadius && r.distance > currentRadius)
                .slice(0, 10);

            if (newRiders.length === 0) continue;

            // Notify riders
            for (const rider of newRiders) {
                await emitSocketEvent(`rider_${rider.id}`, 'new_order', {
                    orderId: order.id,
                    orderType: 'food',
                    restaurantId: order.restaurant_id,
                    restaurantName: order.restaurant_name,
                    restaurantAddress: order.restaurant_address || '',
                    totalAmount: parseFloat(order.total_amount).toFixed(2),
                    message: `Pickup at ${order.restaurant_name} - ₱${parseFloat(order.total_amount).toFixed(2)}`,
                    estimatedDistance: rider.distance.toFixed(2)
                });
            }

            console.log(`[Worker] Order #${order.id} expanded to ${newRadius}km. Notified ${newRiders.length} riders.`);
        }
    } catch (err) {
        console.error('[Worker] Notification Expansion Error:', err.message);
    }
}
