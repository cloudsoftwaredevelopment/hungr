import mysql from 'mysql2/promise';

async function migrateRiderWallet() {
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Tura2020!',
        database: 'hungr',
        multipleStatements: true
    });

    console.log('🚀 Starting Rider Wallet Migration...\n');

    try {
        // 1. Rider Wallets Table
        console.log('Creating rider_wallets table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_wallets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL UNIQUE,
                wallet_status ENUM('active', 'frozen', 'closed') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
                INDEX idx_rider_id (rider_id)
            ) ENGINE=InnoDB
        `);
        console.log('✅ rider_wallets created\n');

        // 2. Rider Wallet Ledger (Append-Only)
        console.log('Creating rider_wallet_ledger table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_wallet_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL,
                entry_type ENUM('credit', 'debit') NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                running_balance DECIMAL(12, 2) NOT NULL,
                reference_id VARCHAR(100),
                description TEXT,
                idempotency_key VARCHAR(64) UNIQUE,
                prev_hash VARCHAR(64),
                entry_hash VARCHAR(64) NOT NULL,
                status ENUM('pending', 'confirmed', 'reversed') DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rider_id) REFERENCES riders(id),
                INDEX idx_rider_id (rider_id),
                INDEX idx_created_at (created_at),
                INDEX idx_idempotency (idempotency_key)
            ) ENGINE=InnoDB
        `);
        console.log('✅ rider_wallet_ledger created\n');

        // 3. Rider Top-Up Requests
        console.log('Creating rider_topup_requests table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS rider_topup_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rider_id INT NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                payment_method ENUM('gcash', 'maya', 'bank_deposit') NOT NULL,
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
        console.log('✅ rider_topup_requests created\n');

        // 4. Immutability Trigger for Ledger
        console.log('Creating immutability triggers...');
        await db.query(`DROP TRIGGER IF EXISTS prevent_rider_ledger_update`);
        await db.query(`DROP TRIGGER IF EXISTS prevent_rider_ledger_delete`);

        await db.query(`
            CREATE TRIGGER prevent_rider_ledger_update
            BEFORE UPDATE ON rider_wallet_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be modified';
            END
        `);

        await db.query(`
            CREATE TRIGGER prevent_rider_ledger_delete
            BEFORE DELETE ON rider_wallet_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be deleted';
            END
        `);
        console.log('✅ Immutability triggers created\n');

        console.log('🎉 Rider Wallet Migration Complete!\n');
        console.log('Tables created:');
        console.log('  - rider_wallets');
        console.log('  - rider_wallet_ledger');
        console.log('  - rider_topup_requests');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await db.end();
    }
}

migrateRiderWallet();
