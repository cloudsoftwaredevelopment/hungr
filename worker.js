/**
 * worker.js - Hungr Background Process
 * Handles periodic tasks separated from the main API server.
 */

import { autoCancelTimeoutOrders } from './src/tasks/autoCancel.js';
import { expandNotificationRadius } from './src/tasks/notificationExpansion.js';
import { AUTO_CANCEL_MINUTES } from './src/config/constants.js';

console.log('[Worker] Starting background process...');

import { initDb } from './src/config/initDb.js';

// Run immediately on start
initDb();
autoCancelTimeoutOrders();
expandNotificationRadius();

// Schedule Intervals

// 1. Auto-Cancel Monitor (Every 1 minute)
// Checks for orders older than AUTO_CANCEL_MINUTES (5 mins)
setInterval(autoCancelTimeoutOrders, 60 * 1000);
console.log(`[Worker] Auto-cancel monitor scheduled (Check every 60s, Timeout: ${AUTO_CANCEL_MINUTES}m)`);

// 2. Notification Expansion (Every 1 minute)
// Expands search radius for pending orders
setInterval(expandNotificationRadius, 60 * 1000);
console.log('[Worker] Notification expansion monitor scheduled (Check every 60s)');

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Worker] Received SIGTERM, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Worker] Received SIGINT, shutting down...');
    process.exit(0);
});
