import dotenv from 'dotenv';
dotenv.config();

// Strict validation of critical variables
const requiredVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const missingVars = requiredVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1); // Crash the app intentionally
}

export const env = {
    PORT: process.env.PORT || 3000,
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: '24h',
    NODE_ENV: process.env.NODE_ENV || 'development',
    WALLET_SYSTEM_KEY: process.env.WALLET_SYSTEM_KEY || 'hungr-admin-2024',
    REQUEST_SECRET: process.env.REQUEST_SECRET || 'default_secret',
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'internal_secret_' + (process.env.start_time || Date.now()), // Auto-generated if missing for dev
    // Add other vars as needed
};
