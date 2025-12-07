
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: 'hungr'
};

async function checkIds() {
    try {
        const conn = await mysql.createConnection(config);
        const [rows] = await conn.query('SELECT id, user_id FROM riders');
        console.log('Rider IDs:', rows);

        const matching = rows.every(r => r.id === r.user_id);
        console.log('All IDs match?', matching);

        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

checkIds();
