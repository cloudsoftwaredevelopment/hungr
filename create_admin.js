import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function createAdmin() {
    const password = 'HungrAdmin2024!';
    const hash = await bcrypt.hash(password, 10);

    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Tura2020!',
        database: 'hungr'
    });

    try {
        // Check if admin exists
        const [existing] = await db.execute('SELECT id FROM merchants WHERE email = ?', ['admin@hungr.food']);

        if (existing.length > 0) {
            console.log('Admin already exists with ID:', existing[0].id);
            // Update password
            await db.execute('UPDATE merchants SET password_hash = ? WHERE email = ?', [hash, 'admin@hungr.food']);
            console.log('Password updated!');
        } else {
            // Create admin
            const [result] = await db.execute(`
                INSERT INTO merchants (name, email, password_hash, phone_number, restaurant_id, status)
                VALUES (?, ?, ?, ?, NULL, 'active')
            `, ['Hungr Admin', 'admin@hungr.food', hash, '09000000000']);
            console.log('Admin created with ID:', result.insertId);
        }

        console.log('\n✅ Admin Account Ready:');
        console.log('   Email: admin@hungr.food');
        console.log('   Password: HungrAdmin2024!');

    } finally {
        await db.end();
    }
}

createAdmin().catch(console.error);
