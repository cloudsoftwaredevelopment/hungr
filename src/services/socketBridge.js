import fetch from 'node-fetch';
import { env } from '../config/env.js';

const API_URL = `http://localhost:${env.PORT}/api/internal/socket`;

/**
 * Sends a request to the main API server to emit a Socket.IO event.
 * @param {string} room - The socket room to emit to (optional, emits to all if null)
 * @param {string} event - The event name
 * @param {object} data - The payload
 */
export async function emitSocketEvent(room, event, data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': env.INTERNAL_API_KEY
            },
            body: JSON.stringify({ room, event, data })
        });

        if (!response.ok) {
            console.error(`[SocketBridge] Failed to emit ${event}: ${response.statusText}`);
        }
    } catch (err) {
        console.error(`[SocketBridge] Error emitting ${event}:`, err.message);
    }
}
