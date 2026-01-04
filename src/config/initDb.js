import pool from './db.js';

export async function initDb() {
    try {
        const poolPromise = pool.promise();

        // FORCE RESET SCHEMA (Fixing missing columns)
        await poolPromise.execute('DROP TABLE IF EXISTS pabili_items');
        await poolPromise.execute('DROP TABLE IF EXISTS pabili_orders');
        console.log("Dropped Pabili tables for schema reset.");

        await poolPromise.execute(`
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
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS pabili_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pabili_order_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                quantity VARCHAR(100) NOT NULL,
                FOREIGN KEY (pabili_order_id) REFERENCES pabili_orders(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS cancelled_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'pabili', 'mart') DEFAULT 'pabili',
                rider_id INT NOT NULL,
                reason TEXT,
                cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS declined_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'store') DEFAULT 'food',
                item_name VARCHAR(255),
                quantity INT,
                reason TEXT,
                declined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS prepared_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                order_type ENUM('food', 'store') DEFAULT 'food',
                restaurant_id INT,
                accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ready_at TIMESTAMP NULL
            ) ENGINE=InnoDB;
        `);
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS store_paid_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                store_id INT NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50),
                status ENUM('pending', 'paid', 'assigned', 'completed', 'cancelled') DEFAULT 'pending',
                delivery_address TEXT,
                rider_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);
        // Note: We might need a store_order_items table too, but for now assuming items are JSON or simplified
        // Let's create store_order_items to be safe and structured
        await poolPromise.execute(`
             CREATE TABLE IF NOT EXISTS store_order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT, 
                product_name VARCHAR(255),
                quantity INT,
                price DECIMAL(10,2),
                FOREIGN KEY (order_id) REFERENCES store_paid_orders(id) ON DELETE CASCADE
             ) ENGINE=InnoDB;
        `);

        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS ride_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                pickup_lat DECIMAL(10, 8),
                pickup_lon DECIMAL(11, 8),
                pickup_address TEXT,
                dropoff_lat DECIMAL(10, 8),
                dropoff_lon DECIMAL(11, 8),
                dropoff_address TEXT,
                fare DECIMAL(10,2) NOT NULL,
                distance_km DECIMAL(10,2),
                status ENUM('pending', 'accepted', 'in_transit', 'completed', 'cancelled') DEFAULT 'pending',
                rider_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB;
        `);

        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS restaurant_watchers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                restaurant_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_watcher (user_id, restaurant_id)
            ) ENGINE=InnoDB;
        `);

        // Add cost column to menu_items if it doesn't exist
        try {
            await poolPromise.execute(`
                ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0.00
            `);
            console.log("menu_items.cost column checked/added.");
        } catch (e) {
            // Column might already exist in some DB versions that don't support IF NOT EXISTS
            console.log("menu_items.cost column might already exist.");
        }

        // Add cost_at_time column to order_items if it doesn't exist
        try {
            await poolPromise.execute(`
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_time DECIMAL(10,2) DEFAULT 0.00
            `);
            console.log("order_items.cost_at_time column checked/added.");
        } catch (e) {
            console.log("order_items.cost_at_time column might already exist.");
        }

        // Add premium subscription columns to restaurants
        try {
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_premium TINYINT(1) DEFAULT 0
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_expires_at DATETIME DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_banner_image VARCHAR(255) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS premium_tagline VARCHAR(100) DEFAULT NULL
            `);
            console.log("restaurants premium columns checked/added.");
        } catch (e) {
            console.log("restaurants premium columns might already exist.");
        }

        // Add delivery_eta_arrival and instructions to orders and store_paid_orders
        try {
            await poolPromise.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_eta_arrival DATETIME DEFAULT NULL');
            await poolPromise.execute('ALTER TABLE store_paid_orders ADD COLUMN IF NOT EXISTS delivery_eta_arrival DATETIME DEFAULT NULL');
            await poolPromise.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL');
            await poolPromise.execute('ALTER TABLE store_paid_orders ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL');
            console.log("delivery_eta_arrival and instructions columns checked/added.");
        } catch (e) {
            console.log("columns might already exist.");
        }

        // Add location columns to restaurants (for Haversine rider dispatch)
        try {
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL
            `);
            console.log("restaurants location columns checked/added.");
        } catch (e) {
            console.log("restaurants location columns might already exist.");
        }

        // NEW: Add commission_rate and marketing settings to restaurants
        try {
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 12.00
            `);
            await poolPromise.execute(`
                ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            console.log("restaurants commission columns checked/added.");
        } catch (e) {
            console.log("restaurants commission columns error/exists.");
        }

        // NEW: Create merchant_campaigns table
        await poolPromise.execute(`
            CREATE TABLE IF NOT EXISTS merchant_campaigns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                restaurant_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                discount_percentage DECIMAL(5,2) DEFAULT 0.00,
                is_co_funded TINYINT(1) DEFAULT 1,
                is_active TINYINT(1) DEFAULT 0,
                start_date TIMESTAMP NULL,
                end_date TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log("merchant_campaigns table checked/added.");

        // Add location columns to merchants (linked to restaurants)
        try {
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL
            `);
            console.log("merchants location columns checked/added.");
        } catch (e) {
            console.log("merchants location columns might already exist.");
        }

        // Add location columns to stores (for Pabili/Store orders)
        try {
            await poolPromise.execute(`
                ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            console.log("stores location columns checked/added.");
        } catch (e) {
            console.log("stores location columns might already exist.");
        }

        // Add rider_id and payment_method to orders table (for rider assignment and payment status)
        try {
            await poolPromise.execute(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_id INT DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'COD'
            `);
            console.log("orders schema updated (rider_id, payment_method).");
        } catch (e) {
            console.log("orders schema update might already exist.");
        }

        // Add last_location_update to riders table
        try {
            await poolPromise.execute(`
                ALTER TABLE riders ADD COLUMN IF NOT EXISTS last_location_update DATETIME DEFAULT NULL
            `);
            console.log("riders.last_location_update column checked/added.");
        } catch (e) {
            console.log("riders.last_location_update column might already exist.");
        }

        // Add location columns to users table (for customer delivery location)
        try {
            await poolPromise.execute(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) DEFAULT NULL
            `);
            await poolPromise.execute(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) DEFAULT NULL
            `);
            console.log("users location columns checked/added.");
        } catch (e) {
            console.log("users location columns might already exist.");
        }

        console.log("Database initialized successfully.");
    } catch (e) {
        console.error("Table Init Error:", e);
    }
}
