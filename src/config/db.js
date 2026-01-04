import mysql from 'mysql2';
import { env } from './env.js';

const pool = mysql.createPool({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('FATAL ERROR: Database connection failed:', err.message);
        process.exit(1);
    }
    if (connection) {
        console.log('Database connected successfully');
        connection.release();
    }
});

// Helper to return [rows, fields] from a query
export const db = {
    query: async (sql, params) => {
        return await pool.promise().query(sql, params);
    },
    execute: async (sql, params) => {
        return await pool.promise().execute(sql, params);
    },
    // Expose pool if needed
    pool: pool
};

export default pool;
