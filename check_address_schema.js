
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    host: 'localhost',
    user: 'hungr_user',
    password: 'password123',
    database: 'hungr_db'
};

async function check() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute("DESCRIBE user_addresses");
        console.log('Columns:', rows.map(r => r.Field));
        await conn.end();
    } catch (e) { console.error(e); }
}
check();
