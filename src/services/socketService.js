import pool from '../config/db.js';

// Store active rider sockets for room management
const activeRiders = new Map(); // riderId -> socketId

/**
 * Initialize Socket.IO event handlers
 * @param {import('socket.io').Server} io 
 */
export const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // Rider goes online - join their dedicated room
        socket.on('rider_online', (data) => {
            const { riderId, latitude, longitude } = data;
            if (riderId) {
                socket.join(`rider_${riderId}`);
                activeRiders.set(riderId, socket.id);
                console.log(`[Socket] Rider #${riderId} joined room rider_${riderId}`);

                // Update rider location if provided
                if (latitude && longitude) {
                    pool.promise().execute(
                        'UPDATE riders SET current_latitude = ?, current_longitude = ?, is_online = 1 WHERE id = ?',
                        [latitude, longitude, riderId]
                    ).catch(err => console.error('Failed to update rider location:', err));
                }
            }
        });

        // Rider goes offline
        socket.on('rider_offline', (data) => {
            const { riderId } = data;
            if (riderId) {
                socket.leave(`rider_${riderId}`);
                activeRiders.delete(riderId);
                console.log(`[Socket] Rider #${riderId} left room`);
            }
        });

        // Rider location update
        socket.on('rider_location_update', async (data) => {
            const { riderId, latitude, longitude } = data;
            if (riderId && latitude && longitude) {
                try {
                    await pool.promise().execute(
                        'UPDATE riders SET current_latitude = ?, current_longitude = ?, last_location_update = NOW() WHERE id = ?',
                        [latitude, longitude, riderId]
                    );
                } catch (err) {
                    console.error('Failed to update rider location:', err);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
            // Remove from activeRiders map
            for (const [riderId, socketId] of activeRiders.entries()) {
                if (socketId === socket.id) {
                    activeRiders.delete(riderId);
                    break;
                }
            }
        });
    });
};
