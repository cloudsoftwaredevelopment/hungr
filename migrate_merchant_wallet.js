/**
 * Merchant Wallet Database Migration
 * Creates the enterprise-grade wallet schema with:
 * - Append-only immutable ledger
 * - Double-entry accounting support
 * - Cryptographic hash chain for tamper detection
 * - Audit logging
 * 
 * Run: node migrate_merchant_wallet.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'hungr',
    multipleStatements: true
};

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection(config);
        console.log('✅ Connected to database');

        // =============================================
        // 1. MERCHANT WALLETS (Metadata Table)
        // =============================================
        console.log('\n📦 Creating merchant_wallets table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_wallets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL UNIQUE,
                wallet_status ENUM('active','frozen','suspended') DEFAULT 'active',
                pin_hash VARCHAR(255) DEFAULT NULL,
                requires_2fa BOOLEAN DEFAULT TRUE,
                daily_limit DECIMAL(12,2) DEFAULT 50000.00,
                monthly_limit DECIMAL(12,2) DEFAULT 500000.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
                INDEX idx_status (wallet_status)
            ) ENGINE=InnoDB;
        `);
        console.log('   ✅ merchant_wallets table created');

        // =============================================
        // 2. MERCHANT WALLET LEDGER (Append-Only Immutable)
        // =============================================
        console.log('\n📦 Creating merchant_wallet_ledger table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_wallet_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                entry_type ENUM('debit','credit') NOT NULL,
                transaction_type ENUM('bond','topup','withdrawal','fee','payment','refund','adjustment') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                running_balance DECIMAL(12,2) NOT NULL,
                
                -- Double-Entry Accounting
                counterparty_type ENUM('hungr_bank','hungr_operations','customer','rider') NOT NULL,
                counterparty_id VARCHAR(100),
                
                -- Integrity Chain
                prev_hash VARCHAR(64),
                entry_hash VARCHAR(64) NOT NULL,
                
                -- Idempotency
                idempotency_key VARCHAR(64) UNIQUE,
                
                -- Metadata
                reference_type VARCHAR(50),
                reference_id BIGINT,
                description TEXT,
                status ENUM('pending','confirmed','failed','reversed') DEFAULT 'confirmed',
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by_type ENUM('system','admin','merchant') NOT NULL,
                created_by_id INT,
                
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                INDEX idx_merchant_status (merchant_id, status),
                INDEX idx_created (created_at),
                INDEX idx_idempotency (idempotency_key),
                INDEX idx_reference (reference_type, reference_id)
            ) ENGINE=InnoDB;
        `);
        console.log('   ✅ merchant_wallet_ledger table created');

        // =============================================
        // 3. MERCHANT TOPUP REQUESTS
        // =============================================
        console.log('\n📦 Creating merchant_topup_requests table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_topup_requests (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                idempotency_key VARCHAR(64) NOT NULL UNIQUE,
                amount DECIMAL(12,2) NOT NULL,
                request_type ENUM('bond','topup') DEFAULT 'topup',
                payment_method ENUM('bank_deposit','gcash','maya') NOT NULL,
                payment_reference VARCHAR(100),
                proof_image_path VARCHAR(500) NOT NULL,
                
                -- Approval Workflow
                status ENUM('pending','under_review','approved','rejected','cancelled') DEFAULT 'pending',
                reviewed_by INT DEFAULT NULL,
                reviewed_at TIMESTAMP NULL,
                review_notes TEXT,
                
                -- Security
                request_signature VARCHAR(128),
                ip_address VARCHAR(45),
                user_agent TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 7 DAY),
                
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                INDEX idx_status (status),
                INDEX idx_merchant_status (merchant_id, status),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB;
        `);
        console.log('   ✅ merchant_topup_requests table created');

        // =============================================
        // 4. MERCHANT WITHDRAWAL REQUESTS
        // =============================================
        console.log('\n📦 Creating merchant_withdrawal_requests table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS merchant_withdrawal_requests (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                idempotency_key VARCHAR(64) NOT NULL UNIQUE,
                amount DECIMAL(12,2) NOT NULL,
                destination_type ENUM('bank','gcash','maya') NOT NULL,
                destination_account VARCHAR(100) NOT NULL,
                destination_name VARCHAR(200) NOT NULL,
                
                -- Security: Require PIN + OTP for withdrawals
                pin_verified BOOLEAN DEFAULT FALSE,
                otp_verified BOOLEAN DEFAULT FALSE,
                
                status ENUM('pending','processing','completed','failed','cancelled') DEFAULT 'pending',
                processed_by INT DEFAULT NULL,
                processed_at TIMESTAMP NULL,
                failure_reason TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB;
        `);
        console.log('   ✅ merchant_withdrawal_requests table created');

        // =============================================
        // 5. WALLET AUDIT LOG
        // =============================================
        console.log('\n📦 Creating wallet_audit_log table...');
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS wallet_audit_log (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT,
                action VARCHAR(100) NOT NULL,
                actor_type ENUM('merchant','admin','system') NOT NULL,
                actor_id INT,
                ip_address VARCHAR(45),
                request_data JSON,
                response_summary VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_merchant (merchant_id),
                INDEX idx_action (action),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB;
        `);
        console.log('   ✅ wallet_audit_log table created');

        // =============================================
        // 6. IMMUTABILITY TRIGGERS (Prevent UPDATE/DELETE on ledger)
        // =============================================
        console.log('\n🔒 Creating immutability triggers...');

        // Drop existing triggers if they exist
        try {
            await conn.execute('DROP TRIGGER IF EXISTS prevent_ledger_modification');
            await conn.execute('DROP TRIGGER IF EXISTS prevent_ledger_deletion');
        } catch (e) {
            // Triggers might not exist
        }

        // Create UPDATE prevention trigger
        await conn.execute(`
            CREATE TRIGGER prevent_ledger_modification
            BEFORE UPDATE ON merchant_wallet_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be modified - append-only';
            END
        `);
        console.log('   ✅ UPDATE prevention trigger created');

        // Create DELETE prevention trigger
        await conn.execute(`
            CREATE TRIGGER prevent_ledger_deletion
            BEFORE DELETE ON merchant_wallet_ledger
            FOR EACH ROW
            BEGIN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be deleted - append-only';
            END
        `);
        console.log('   ✅ DELETE prevention trigger created');

        // =============================================
        // 7. ADD ENVIRONMENT VARIABLE REMINDER
        // =============================================
        console.log('\n' + '='.repeat(60));
        console.log('🎉 MIGRATION COMPLETE!');
        console.log('='.repeat(60));
        console.log('\n⚠️  IMPORTANT: Add these to your .env file:');
        console.log('   WALLET_SYSTEM_KEY=<generate-a-secure-random-key>');
        console.log('   REQUEST_SECRET=<generate-another-secure-key>');
        console.log('\nGenerate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_CANNOT_ADD_FOREIGN') {
            console.error('\n⚠️  Foreign key error - ensure merchants table exists');
        }
        throw error;
    } finally {
        if (conn) await conn.end();
    }
}

migrate().then(() => {
    console.log('\n✅ Migration script finished');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Migration failed with error:', err);
    process.exit(1);
});
