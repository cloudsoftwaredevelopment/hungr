import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'Tura2020!',
    database: process.env.DB_NAME || 'hungr'
};

async function checkSchema() {
    try {
        const conn = await mysql.createConnection(config);
        const [tables] = await conn.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables:', tableNames);

        for (const tableName of tableNames) {
            if (tableName.includes('item')) {
                const [cols] = await conn.query(`DESCRIBE ${tableName}`);
                console.log(`${tableName} columns:`, cols.map(c => c.Field));
            }
        }

        await conn.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
