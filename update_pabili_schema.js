
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    host: 'localhost',
    user: 'hungr_user',
    password: 'password123',
    database: 'hungr_db'
};

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log("Connected to DB...");

        // 1. pabili_orders
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS pabili_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                store_id INT NOT NULL,
                rider_id INT DEFAULT NULL,
                estimated_cost DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'accepted', 'purchasing', 'delivering', 'completed', 'cancelled') DEFAULT 'pending',
                delivery_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);
        console.log("pabili_orders table ready.");

        // 2. pabili_items
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS pabili_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pabili_order_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                quantity VARCHAR(100) NOT NULL,
                FOREIGN KEY (pabili_order_id) REFERENCES pabili_orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log("pabili_items table ready.");

        // 3. cancelled_orders
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS cancelled_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'pabili', 'mart') DEFAULT 'pabili',
                rider_id INT NOT NULL,
                reason TEXT,
                cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log("cancelled_orders table ready.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
