import { db } from '../config/db.js';
import crypto from 'crypto';

/**
 * Helper to get customer balance from ledger
 */
export async function getCustomerBalance(userId, paymentMethod) {
    const table = paymentMethod === 'coins' ? 'customer_coin_ledger' : 'customer_wallet_ledger';
    const [balanceRow] = await db.execute(`
        SELECT 
            COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
        FROM ${table} WHERE user_id = ?
    `, [userId]);
    return parseFloat(balanceRow[0]?.balance || 0);
}

/**
 * Helper to process a customer payment (debit) from wallet or coins
 */
export async function processCustomerPayment(userId, amount, orderId, paymentMethod) {
    const table = paymentMethod === 'coins' ? 'customer_coin_ledger' : 'customer_wallet_ledger';
    const transactionType = 'order_payment';

    // 1. Calculate Balance from ledger
    const [balanceRow] = await db.execute(`
        SELECT 
            COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
        FROM ${table} WHERE user_id = ?
    `, [userId]);

    const balance = parseFloat(balanceRow[0]?.balance || 0);
    if (balance < amount) {
        throw new Error(`Insufficient ${paymentMethod} balance. Required: ₱${amount}, Available: ₱${balance}`);
    }

    // 2. Get previous ledger entry hash for chain
    const [lastEntry] = await db.execute(`
        SELECT entry_hash FROM ${table} 
        WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `, [userId]);

    const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
    const idempotencyKey = `pay_${paymentMethod}_u${userId}_o${orderId || Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // 3. Create entry hash (userId:amount:type:key:prevHash)
    const newBalance = balance - amount;
    const hashData = `${userId}:${amount}:debit:${idempotencyKey}:${prevHash}`;
    const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

    // 4. Insert ledger entry
    await db.execute(`
        INSERT INTO ${table} 
        (user_id, entry_type, transaction_type, amount, running_balance, 
         reference_id, description, idempotency_key, prev_hash, entry_hash, status)
        VALUES (?, 'debit', ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `, [
        userId, transactionType, amount, newBalance,
        orderId ? `order_${orderId}` : null,
        `Payment for Order #${orderId || 'TBA'}`,
        idempotencyKey, prevHash, entryHash
    ]);

    return {
        success: true,
        newBalance: newBalance.toFixed(2),
        transactionId: idempotencyKey
    };
}
