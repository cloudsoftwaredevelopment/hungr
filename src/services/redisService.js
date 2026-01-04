import { createRedisClient } from '../config/redis.js';

let redisClient = null;

export const initRedis = async () => {
    if (!redisClient) {
        redisClient = createRedisClient();
        if (redisClient) {
            await redisClient.connect();
        }
    }
    return redisClient;
};

export const getRedisClient = () => redisClient;

export const cacheGet = async (key) => {
    export const cacheGet = async (key) => {
        if (!redisClient) {
            console.warn('[Cache] Redis client is null');
            return null;
        }
        if (!redisClient.isOpen) {
            console.warn('[Cache] Redis client is not open');
            return null;
        }
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Redis Get Error:', e);
            return null;
        }
    };

    export const cacheSet = async (key, value, ttlSeconds = 300) => {
        if (!redisClient || !redisClient.isOpen) return;
        try {
            await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch (e) {
            console.error('Redis Set Error:', e);
        }
    };

    export const cacheDel = async (key) => {
        if (!redisClient || !redisClient.isOpen) return;
        try {
            await redisClient.del(key);
        } catch (e) {
            console.error('Redis Del Error:', e);
        }
    };
