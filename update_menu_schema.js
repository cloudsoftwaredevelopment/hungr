import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: process.env.DB_NAME || 'hungr'
};

async function updateSchema() {
    try {
        const conn = await mysql.createConnection(config);
        console.log('Adding preparation_time_sec to menu_items...');
        await conn.query('ALTER TABLE menu_items ADD COLUMN preparation_time_sec INT DEFAULT 0 AFTER preparation_time_min');
        console.log('Schema updated successfully.');
        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

updateSchema();
