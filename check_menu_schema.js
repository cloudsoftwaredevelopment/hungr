
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: 'hungr'
};

async function checkSchema() {
    try {
        const conn = await mysql.createConnection(config);
        const [cols] = await conn.query('DESCRIBE menu_items');
        console.log('menu_items columns:');
        cols.forEach(c => console.log(`${c.Field}: ${c.Type}`));
        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
