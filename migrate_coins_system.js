import mysql from 'mysql2/promise';

async function migrateCoinsSystem() {
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Tura2020!',
        database: 'hungr',
        multipleStatements: true
    });

    console.log('🪙 Starting Hungr Coins System Migration...\n');

    try {
        // ==========================================
        // MERCHANT COINS
        // ==========================================

        console.log('Creating merchant_coins table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS merchant_coins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
                INDEX idx_merchant_id (merchant_id)
            ) ENGINE=InnoDB
        `);
        console.log('✅ merchant_coins created\n');

        console.log('Creating merchant_coin_ledger table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS merchant_coin_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                entry_type ENUM('credit', 'debit') NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount INT NOT NULL,
                running_balance INT NOT NULL,
                reference_id VARCHAR(100),
                recipient_user_id INT,
                description TEXT,
                idempotency_key VARCHAR(64) UNIQUE,
                prev_hash VARCHAR(64),
                entry_hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                INDEX idx_merchant_id (merchant_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB
        `);
        console.log('✅ merchant_coin_ledger created\n');

        console.log('Creating merchant_coin_topup_requests table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS merchant_coin_topup_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                amount INT NOT NULL,
                peso_amount DECIMAL(12, 2) NOT NULL,
                payment_method ENUM('gcash', 'maya', 'bank_deposit', 'wallet') NOT NULL,
                payment_reference VARCHAR(100),
                proof_image_path VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                idempotency_key VARCHAR(64) UNIQUE,
                reviewed_by INT,
                reviewed_at TIMESTAMP NULL,
                review_notes TEXT,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                INDEX idx_merchant_id (merchant_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB
        `);
        console.log('✅ merchant_coin_topup_requests created\n');

        // ==========================================
        // RIDER COINS
        // ==========================================

        console.log('Creating rider_coins table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_coins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
                INDEX idx_rider_id (rider_id)
            ) ENGINE=InnoDB
        `);
        console.log('✅ rider_coins created\n');

        console.log('Creating rider_coin_ledger table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_coin_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL,
                entry_type ENUM('credit', 'debit') NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount INT NOT NULL,
                running_balance INT NOT NULL,
                reference_id VARCHAR(100),
                recipient_user_id INT,
                description TEXT,
                idempotency_key VARCHAR(64) UNIQUE,
                prev_hash VARCHAR(64),
                entry_hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rider_id) REFERENCES riders(id),
                INDEX idx_rider_id (rider_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB
        `);
        console.log('✅ rider_coin_ledger created\n');

        console.log('Creating rider_coin_topup_requests table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_coin_topup_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL,
                amount INT NOT NULL,
                peso_amount DECIMAL(12, 2) NOT NULL,
                payment_method ENUM('gcash', 'maya', 'bank_deposit', 'wallet') NOT NULL,
                payment_reference VARCHAR(100),
                proof_image_path VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                idempotency_key VARCHAR(64) UNIQUE,
                reviewed_by INT,
                reviewed_at TIMESTAMP NULL,
                review_notes TEXT,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rider_id) REFERENCES riders(id),
                INDEX idx_rider_id (rider_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB
        `);
        console.log('✅ rider_coin_topup_requests created\n');

        // ==========================================
        // CUSTOMER COINS (Enhanced from hungr_coins)
        // ==========================================

        console.log('Creating customer_coin_ledger table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS customer_coin_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                entry_type ENUM('credit', 'debit') NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount INT NOT NULL,
                running_balance INT NOT NULL,
                source_type ENUM('system', 'merchant', 'rider') DEFAULT 'system',
                source_id INT,
                reference_id VARCHAR(100),
                description TEXT,
                idempotency_key VARCHAR(64) UNIQUE,
                prev_hash VARCHAR(64),
                entry_hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at),
                INDEX idx_source (source_type, source_id)
            ) ENGINE=InnoDB
        `);
        console.log('✅ customer_coin_ledger created\n');

        // ==========================================
        // COIN EARNING RULES (Flexible Config)
        // ==========================================

        console.log('Creating coin_earning_rules table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS coin_earning_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action_code VARCHAR(50) NOT NULL UNIQUE,
                description VARCHAR(255) NOT NULL,
                coin_amount INT NOT NULL,
                source_type ENUM('system', 'merchant', 'rider') DEFAULT 'system',
                is_active BOOLEAN DEFAULT TRUE,
                min_order_amount DECIMAL(10,2),
                max_daily_limit INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_action_code (action_code),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB
        `);
        console.log('✅ coin_earning_rules created\n');

        // Insert default earning rules
        console.log('Inserting default earning rules...');
        await db.execute(`
            INSERT IGNORE INTO coin_earning_rules (action_code, description, coin_amount, source_type) VALUES
            ('order_complete', 'Complete a food order', 10, 'system'),
            ('bulk_order', 'Order 5+ items', 50, 'system'),
            ('first_order', 'First purchase bonus', 100, 'system'),
            ('wallet_payment', 'Pay using Hungr Wallet', 5, 'system'),
            ('advance_booking', 'Book order in advance', 15, 'system'),
            ('store_browse', 'Browse a store menu', 1, 'merchant'),
            ('five_star_feedback', '5-star delivery rating', 5, 'rider'),
            ('referral_signup', 'Referred user signs up', 50, 'system'),
            ('referral_order', 'Referred user completes first order', 100, 'system')
        `);
        console.log('✅ Default earning rules inserted\n');

        // ==========================================
        // COIN TRANSFERS (Track awards)
        // ==========================================

        console.log('Creating coin_transfers table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS coin_transfers (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                from_type ENUM('merchant', 'rider', 'system') NOT NULL,
                from_id INT,
                to_user_id INT NOT NULL,
                amount INT NOT NULL,
                reason VARCHAR(100),
                action_code VARCHAR(50),
                order_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (to_user_id) REFERENCES users(id),
                INDEX idx_from (from_type, from_id),
                INDEX idx_to_user (to_user_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB
        `);
        console.log('✅ coin_transfers created\n');

        // ==========================================
        // IMMUTABILITY TRIGGERS
        // ==========================================

        console.log('Creating immutability triggers...');

        // Merchant coin ledger triggers
        await db.query(`DROP TRIGGER IF EXISTS prevent_merchant_coin_ledger_update`);
        await db.query(`DROP TRIGGER IF EXISTS prevent_merchant_coin_ledger_delete`);
        await db.query(`
            CREATE TRIGGER prevent_merchant_coin_ledger_update
            BEFORE UPDATE ON merchant_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be modified';
            END
        `);
        await db.query(`
            CREATE TRIGGER prevent_merchant_coin_ledger_delete
            BEFORE DELETE ON merchant_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be deleted';
            END
        `);

        // Rider coin ledger triggers
        await db.query(`DROP TRIGGER IF EXISTS prevent_rider_coin_ledger_update`);
        await db.query(`DROP TRIGGER IF EXISTS prevent_rider_coin_ledger_delete`);
        await db.query(`
            CREATE TRIGGER prevent_rider_coin_ledger_update
            BEFORE UPDATE ON rider_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be modified';
            END
        `);
        await db.query(`
            CREATE TRIGGER prevent_rider_coin_ledger_delete
            BEFORE DELETE ON rider_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be deleted';
            END
        `);

        // Customer coin ledger triggers
        await db.query(`DROP TRIGGER IF EXISTS prevent_customer_coin_ledger_update`);
        await db.query(`DROP TRIGGER IF EXISTS prevent_customer_coin_ledger_delete`);
        await db.query(`
            CREATE TRIGGER prevent_customer_coin_ledger_update
            BEFORE UPDATE ON customer_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be modified';
            END
        `);
        await db.query(`
            CREATE TRIGGER prevent_customer_coin_ledger_delete
            BEFORE DELETE ON customer_coin_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coin ledger entries cannot be deleted';
            END
        `);

        console.log('✅ Immutability triggers created\n');

        console.log('🎉 Hungr Coins System Migration Complete!\n');
        console.log('Tables created:');
        console.log('  - merchant_coins, merchant_coin_ledger, merchant_coin_topup_requests');
        console.log('  - rider_coins, rider_coin_ledger, rider_coin_topup_requests');
        console.log('  - customer_coin_ledger');
        console.log('  - coin_earning_rules (with default rules)');
        console.log('  - coin_transfers');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await db.end();
    }
}

migrateCoinsSystem();
