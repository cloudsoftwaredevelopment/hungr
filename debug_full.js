import mysql from 'mysql2';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});
const db = pool.promise();

async function debug() {
    try {
        console.log("--- DEBUG START ---");

        // 1. Check Schema
        console.log("\n1. Checking 'users' table schema...");
        const [columns] = await db.query(`SHOW COLUMNS FROM users LIKE 'password_hash'`);
        if (columns.length) {
            console.log("Column definition:", columns[0]);
            const type = columns[0].Type; // e.g. "varchar(255)"
            console.log(`Type: ${type}`);
            if (type.includes('char') && parseInt(type.replace(/\D/g, '')) < 60) {
                console.error("❌ CRITICAL: password_hash column is too short! It truncates the 60-char hash.");
            } else {
                console.log("✅ Column length looks OK.");
            }
        } else {
            console.error("❌ Column password_hash not found!");
        }

        // 2. Check User Data
        const email = 'turawebdesigns@gmail.com';
        const password = 'password123';
        console.log(`\n2. Fetching user: ${email}`);

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.error("❌ User not found in DB.");
            return;
        }

        const user = users[0];
        const storedHash = user.password_hash;
        console.log(`Stored Hash (${storedHash.length} chars): '${storedHash}'`);

        // 3. Verify Hash
        console.log(`\n3. Testing bcrypt.compare('${password}', storedHash)...`);
        const match = await bcrypt.compare(password, storedHash);

        if (match) {
            console.log("✅ SUCCESS: Password matches in script!");
            console.log("If it fails in the app, check if the app receives the correct password string (whitespace?).");
        } else {
            console.error("❌ FAIL: Password does NOT match stored hash.");

            // Generate what it SHOULD be
            const newHash = await bcrypt.hash(password, 10);
            console.log(`\nExpected valid hash for '${password}': ${newHash}`);
            console.log("Try updating the DB with this new hash.");
        }

        process.exit(0);
    } catch (err) {
        console.error("Debug Error:", err);
        process.exit(1);
    }
}

debug();
