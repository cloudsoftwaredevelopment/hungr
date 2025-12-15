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

async function createUser() {
    try {
        // Same password hash as turawebdesigns@gmail.com (password123)
        const userData = {
            username: 'jtura',
            email: 'jtura@gmail.com',
            phone_number: '09392299532',
            password_hash: '$2a$10$OIg5xur96Vpk2NBcn4hyP.7K188IlR2217wZBTJiyVPmG2.xC8JcW',
            address: '11 Quezon St, Villa Arevalo District, Iloilo City, 5000 Iloilo',
            user_type: 'customer',
            profile_image: null
        };

        console.log(`Creating user ${userData.username} (${userData.email})...`);

        const [result] = await db.query(
            `INSERT INTO users (username, email, phone_number, password_hash, address, user_type, profile_image) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userData.username,
                userData.email,
                userData.phone_number,
                userData.password_hash,
                userData.address,
                userData.user_type,
                userData.profile_image
            ]
        );

        console.log(`✅ User created successfully with ID: ${result.insertId}`);
        console.log('User details:');
        console.log(`  - Username: ${userData.username}`);
        console.log(`  - Email: ${userData.email}`);
        console.log(`  - Phone: ${userData.phone_number}`);
        console.log(`  - Address: ${userData.address}`);
        console.log(`  - Password: password123`);

        process.exit(0);
    } catch (err) {
        console.error("Error creating user:", err);
        process.exit(1);
    }
}

createUser();
