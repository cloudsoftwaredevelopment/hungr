
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Config from .env (recreated here if needed, or rely on dotenv finding it in CWD)
// Actually explicit config is safer given we are running from a script
const config = {
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: 'hungr'
};

async function checkTables() {
    try {
        const conn = await mysql.createConnection(config);
        const [tables] = await conn.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        // Check if riders table exists
        const ridersExists = tables.some(t => Object.values(t)[0] === 'riders');
        if (ridersExists) {
            const [cols] = await conn.query('DESCRIBE riders');
            console.log('Riders columns:', cols.map(c => c.Field));

            // Check content for user_id 13 (rider@example.com)
            const [rows] = await conn.query('SELECT * FROM riders');
            console.log('Riders data count:', rows.length);
        } else {
            console.log('Riders table does NOT exist.');
        }
        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

checkTables();
