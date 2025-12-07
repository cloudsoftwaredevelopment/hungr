
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: 'hungr'
};

async function migrate() {
    try {
        const conn = await mysql.createConnection(config);
        console.log("Altering menu_items table...");

        // Change image_url from VARCHAR(255) to LONGTEXT to support Base64 images
        // This is backward compatible with short URLs
        await conn.query('ALTER TABLE menu_items MODIFY image_url LONGTEXT');

        console.log("Migration successful: image_url is now LONGTEXT.");
        await conn.end();
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrate();
