import { createClient } from 'redis';
import { env } from './env.js';

export const createRedisClient = () => {
    if (!env.REDIS_URL) {
        console.warn('⚠️ REDIS_URL not set. Redis features will be disabled.');
        return null;
    }

    const client = createClient({
        url: env.REDIS_URL
    });

    client.on('error', (err) => console.error('Redis Client Error', err));
    client.on('connect', () => console.log('Redis Client Connected'));

    return client;
};
