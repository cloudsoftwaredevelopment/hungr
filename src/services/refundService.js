/**
 * Helper function to create a refund request
 */
export async function createRefundRequest(db, userId, amount, payMethod, orderId, reason, merchantPhone) {
    if (amount <= 0) return null;
    const normalizedPayMethod = (payMethod || '').toLowerCase();
    if (normalizedPayMethod !== 'wallet' && normalizedPayMethod !== 'coins') return null;

    const refundKey = `refund_o${orderId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const reviewNotes = `Refund triggered by merchant action. \nReason: ${reason || 'N/A'}\nMerchant Contact: ${merchantPhone || 'Not available'}`;

    await db.execute(`
        INSERT INTO customer_topup_requests 
        (user_id, request_type, amount, payment_method, payment_reference, status, idempotency_key, review_notes) 
        VALUES (?, 'refund', ?, ?, ?, 'pending', ?, ?)
    `, [
        userId,
        amount,
        normalizedPayMethod,
        `Order #${orderId} Refund`,
        refundKey,
        reviewNotes
    ]);
    console.log(`[Refund] Created refund request for Order #${orderId} (${normalizedPayMethod}): ₱${parseFloat(amount).toFixed(2)}`);
    return refundKey;
}
