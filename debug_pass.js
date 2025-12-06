import bcrypt from 'bcryptjs';
import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});
const db = pool.promise();

async function checkPassword(email, rawPassword) {
    console.log(`Checking user: ${email}`);
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        console.log('User not found.');
        process.exit(1);
    }
    const user = rows[0];
    console.log(`Stored Hash: ${user.password_hash}`);

    const isValid = await bcrypt.compare(rawPassword, user.password_hash);
    console.log(`Match Result: ${isValid}`);

    const newHash = await bcrypt.hash(rawPassword, 10);
    console.log(`New Hash (for 'password123'): ${newHash}`);
    process.exit(0);
}

// Replace with user's email
checkPassword('admin@nfcrevolution.com', 'password123');
