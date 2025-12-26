/**
 * Merchant Wallet API Routes
 * Enterprise-grade wallet with append-only ledger
 * 
 * Features:
 * - Immutable transaction ledger with hash chain
 * - Idempotency key support
 * - Balance calculated from ledger (never stored directly)
 * - Admin approval workflow for top-ups
 * - TOTP (Google Authenticator) for withdrawals
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Proof upload directory
const proofUploadsDir = path.join(process.cwd(), 'uploads', 'wallet-proofs');
if (!fs.existsSync(proofUploadsDir)) {
    fs.mkdirSync(proofUploadsDir, { recursive: true });
}

/**
 * Helper to get customer balance from ledger
 */
export async function getCustomerBalance(db, userId, paymentMethod) {
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
export async function processCustomerPayment(db, userId, amount, orderId, paymentMethod) {
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

export function registerWalletRoutes(apiRouter, db, verifyToken, sendSuccess, sendError, io) {

    // ==========================================
    // 💰 MERCHANT WALLET API
    // ==========================================

    /**
     * GET /merchant/wallet - Get wallet info and calculated balance
     */
    apiRouter.get('/merchant/wallet', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;

            // Get wallet metadata
            const [walletRows] = await db.execute(
                'SELECT * FROM merchant_wallets WHERE merchant_id = ?',
                [merchantId]
            );

            // Calculate balance from ledger (NEVER stored directly)
            const [balanceResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits
                FROM merchant_wallet_ledger 
                WHERE merchant_id = ? AND status = 'confirmed'
            `, [merchantId]);

            const balance = parseFloat(balanceResult[0]?.total_credits || 0) -
                parseFloat(balanceResult[0]?.total_debits || 0);

            // Get pending top-up requests
            const [pendingRequests] = await db.execute(
                'SELECT COUNT(*) as count FROM merchant_topup_requests WHERE merchant_id = ? AND status = "pending"',
                [merchantId]
            );

            // Get recent transactions (last 10)
            const [recentTransactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, running_balance, description, created_at
                FROM merchant_wallet_ledger 
                WHERE merchant_id = ? AND status = 'confirmed'
                ORDER BY created_at DESC LIMIT 10
            `, [merchantId]);

            sendSuccess(res, {
                wallet: walletRows[0] || { wallet_status: 'active', has_pin: false },
                balance: balance.toFixed(2),
                pendingRequests: pendingRequests[0]?.count || 0,
                recentTransactions
            });

        } catch (err) {
            console.error('Wallet fetch error:', err);
            sendError(res, 500, 'Failed to fetch wallet', 'DB_ERROR', err);
        }
    });

    /**
     * GET /merchant/wallet/ledger - Get full transaction history (paginated)
     */
    apiRouter.get('/merchant/wallet/ledger', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, running_balance, 
                       counterparty_type, description, reference_type, reference_id, 
                       status, created_at
                FROM merchant_wallet_ledger 
                WHERE merchant_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [merchantId, limit, offset]);

            const [countResult] = await db.execute(
                'SELECT COUNT(*) as total FROM merchant_wallet_ledger WHERE merchant_id = ?',
                [merchantId]
            );

            sendSuccess(res, {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: countResult[0]?.total || 0,
                    pages: Math.ceil((countResult[0]?.total || 0) / limit)
                }
            });

        } catch (err) {
            console.error('Ledger fetch error:', err);
            sendError(res, 500, 'Failed to fetch ledger', 'DB_ERROR', err);
        }
    });

    /**
     * POST /merchant/wallet/topup - Submit top-up request with proof
     */
    apiRouter.post('/merchant/wallet/topup', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;
            const { amount, paymentMethod, paymentReference, proofImage, idempotencyKey, requestType } = req.body;

            // Validate inputs
            if (!amount || amount <= 0) {
                return sendError(res, 400, 'Invalid amount');
            }
            if (!paymentMethod || !['bank_deposit', 'gcash', 'maya'].includes(paymentMethod)) {
                return sendError(res, 400, 'Invalid payment method');
            }
            if (!proofImage) {
                return sendError(res, 400, 'Proof of payment image is required');
            }
            if (!idempotencyKey) {
                return sendError(res, 400, 'Idempotency key is required');
            }

            // Check idempotency - return cached result if exists
            const [existing] = await db.execute(
                'SELECT id, status, created_at FROM merchant_topup_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, {
                    requestId: existing[0].id,
                    status: existing[0].status,
                    cached: true
                }, 'Request already exists');
            }

            // Generate request signature for verification
            const requestSecret = process.env.REQUEST_SECRET || 'default_secret';
            const signature = crypto.createHmac('sha256', requestSecret)
                .update(`${merchantId}:${amount}:${idempotencyKey}`)
                .digest('hex');

            // Save proof image (base64 to file)
            let proofImagePath = '';
            try {
                const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');
                const filename = `proof_${merchantId}_${Date.now()}.png`;
                proofImagePath = path.join('wallet-proofs', filename);
                fs.writeFileSync(path.join(proofUploadsDir, filename), imageBuffer);
            } catch (imgErr) {
                console.error('Image save error:', imgErr);
                return sendError(res, 400, 'Failed to save proof image');
            }

            // Create pending request
            const [result] = await db.execute(`
                INSERT INTO merchant_topup_requests 
                (merchant_id, idempotency_key, amount, request_type, payment_method, 
                 payment_reference, proof_image_path, request_signature, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                merchantId,
                idempotencyKey,
                amount,
                requestType || 'topup',
                paymentMethod,
                paymentReference || '',
                proofImagePath,
                signature,
                req.ip || req.connection?.remoteAddress || 'unknown',
                req.headers['user-agent'] || 'unknown'
            ]);

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address, request_data)
                VALUES (?, 'topup_request_created', 'merchant', ?, ?, ?)
            `, [merchantId, merchantId, req.ip, JSON.stringify({ amount, paymentMethod, requestId: result.insertId })]);

            console.log(`[Wallet] Merchant #${merchantId} submitted top-up request #${result.insertId} for ₱${amount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Top-up request submitted. Awaiting admin approval.'
            });

        } catch (err) {
            console.error('Top-up request error:', err);
            sendError(res, 500, 'Failed to submit top-up request', 'DB_ERROR', err);
        }
    });

    /**
     * GET /merchant/wallet/requests - Get merchant's top-up request history
     */
    apiRouter.get('/merchant/wallet/requests', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;

            const [requests] = await db.execute(`
                SELECT id, amount, request_type, payment_method, payment_reference, 
                       status, review_notes, created_at, reviewed_at
                FROM merchant_topup_requests 
                WHERE merchant_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `, [merchantId]);

            sendSuccess(res, { requests });

        } catch (err) {
            console.error('Requests fetch error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 🔐 TOTP (2FA) API - Google Authenticator
    // ==========================================

    /**
     * POST /merchant/wallet/2fa/setup - Generate TOTP secret and QR code
     */
    apiRouter.post('/merchant/wallet/2fa/setup', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;

            // Get merchant details for the authenticator label
            const [merchantRows] = await db.execute(
                'SELECT name, email FROM merchants WHERE id = ?',
                [merchantId]
            );
            const merchant = merchantRows[0] || {};

            // Generate new TOTP secret
            const secret = speakeasy.generateSecret({
                name: `Hungr:${merchant.email || 'merchant'}`,
                issuer: 'Hungr Merchant',
                length: 20
            });

            // Generate QR code as data URL
            const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

            // Store secret temporarily (not enabled until verified)
            await db.execute(`
                INSERT INTO merchant_wallets (merchant_id, totp_secret, totp_enabled)
                VALUES (?, ?, FALSE)
                ON DUPLICATE KEY UPDATE totp_secret = ?, totp_enabled = FALSE
            `, [merchantId, secret.base32, secret.base32]);

            console.log(`[2FA] Merchant #${merchantId} initiated 2FA setup`);

            sendSuccess(res, {
                secret: secret.base32,
                qrCode: qrCodeDataUrl,
                message: 'Scan QR code with Google Authenticator, then verify with a code'
            });

        } catch (err) {
            console.error('2FA setup error:', err);
            sendError(res, 500, 'Failed to setup 2FA', 'TOTP_ERROR', err);
        }
    });

    /**
     * POST /merchant/wallet/2fa/verify - Verify TOTP code and enable 2FA
     */
    apiRouter.post('/merchant/wallet/2fa/verify', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;
            const { token } = req.body;

            if (!token) {
                return sendError(res, 400, 'Verification code is required');
            }

            // Get stored secret
            const [walletRows] = await db.execute(
                'SELECT totp_secret FROM merchant_wallets WHERE merchant_id = ?',
                [merchantId]
            );

            if (walletRows.length === 0 || !walletRows[0].totp_secret) {
                return sendError(res, 400, 'Please setup 2FA first');
            }

            // Verify the token
            const verified = speakeasy.totp.verify({
                secret: walletRows[0].totp_secret,
                encoding: 'base32',
                token: token.replace(/\s/g, ''),
                window: 1 // Allow 1 step tolerance (30 seconds before/after)
            });

            if (!verified) {
                return sendError(res, 400, 'Invalid verification code. Please try again.');
            }

            // Enable 2FA
            await db.execute(
                'UPDATE merchant_wallets SET totp_enabled = TRUE WHERE merchant_id = ?',
                [merchantId]
            );

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address)
                VALUES (?, '2fa_enabled', 'merchant', ?, ?)
            `, [merchantId, merchantId, req.ip]);

            console.log(`[2FA] Merchant #${merchantId} enabled 2FA successfully`);

            sendSuccess(res, {
                enabled: true,
                message: '2FA enabled successfully! You will need this code to withdraw funds.'
            });

        } catch (err) {
            console.error('2FA verify error:', err);
            sendError(res, 500, 'Failed to verify 2FA', 'TOTP_ERROR', err);
        }
    });

    /**
     * POST /merchant/wallet/2fa/disable - Disable 2FA (requires current code)
     */
    apiRouter.post('/merchant/wallet/2fa/disable', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;
            const { token } = req.body;

            if (!token) {
                return sendError(res, 400, 'Current 2FA code is required to disable');
            }

            // Get stored secret
            const [walletRows] = await db.execute(
                'SELECT totp_secret, totp_enabled FROM merchant_wallets WHERE merchant_id = ?',
                [merchantId]
            );

            if (walletRows.length === 0 || !walletRows[0].totp_enabled) {
                return sendError(res, 400, '2FA is not enabled');
            }

            // Verify the token
            const verified = speakeasy.totp.verify({
                secret: walletRows[0].totp_secret,
                encoding: 'base32',
                token: token.replace(/\s/g, ''),
                window: 1
            });

            if (!verified) {
                return sendError(res, 400, 'Invalid code. Cannot disable 2FA.');
            }

            // Disable 2FA
            await db.execute(
                'UPDATE merchant_wallets SET totp_enabled = FALSE, totp_secret = NULL WHERE merchant_id = ?',
                [merchantId]
            );

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address)
                VALUES (?, '2fa_disabled', 'merchant', ?, ?)
            `, [merchantId, merchantId, req.ip]);

            console.log(`[2FA] Merchant #${merchantId} disabled 2FA`);

            sendSuccess(res, {
                disabled: true,
                message: '2FA has been disabled.'
            });

        } catch (err) {
            console.error('2FA disable error:', err);
            sendError(res, 500, 'Failed to disable 2FA', 'TOTP_ERROR', err);
        }
    });

    // ==========================================
    // 💸 WITHDRAWAL API
    // ==========================================

    /**
     * POST /merchant/wallet/withdraw - Request withdrawal (requires 2FA)
     */
    apiRouter.post('/merchant/wallet/withdraw', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;
            const { amount, destinationType, destinationAccount, destinationName, totpCode, idempotencyKey } = req.body;

            // Validate inputs
            if (!amount || amount <= 0) {
                return sendError(res, 400, 'Invalid amount');
            }
            if (!destinationType || !['bank', 'gcash', 'maya'].includes(destinationType)) {
                return sendError(res, 400, 'Invalid destination type');
            }
            if (!destinationAccount || !destinationName) {
                return sendError(res, 400, 'Destination account details are required');
            }
            if (!totpCode) {
                return sendError(res, 400, 'Authenticator code is required for withdrawals');
            }
            if (!idempotencyKey) {
                return sendError(res, 400, 'Idempotency key is required');
            }

            // Check idempotency
            const [existingWithdrawal] = await db.execute(
                'SELECT id, status FROM merchant_withdrawal_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existingWithdrawal.length > 0) {
                return sendSuccess(res, {
                    requestId: existingWithdrawal[0].id,
                    status: existingWithdrawal[0].status,
                    cached: true
                });
            }

            // Get wallet and verify 2FA
            const [walletRows] = await db.execute(
                'SELECT totp_secret, totp_enabled, wallet_status FROM merchant_wallets WHERE merchant_id = ?',
                [merchantId]
            );

            if (walletRows.length === 0 || walletRows[0].wallet_status !== 'active') {
                return sendError(res, 400, 'Wallet is not active');
            }

            if (!walletRows[0].totp_enabled) {
                return sendError(res, 400, 'Please enable 2FA before withdrawing');
            }

            // Verify TOTP code
            const verified = speakeasy.totp.verify({
                secret: walletRows[0].totp_secret,
                encoding: 'base32',
                token: totpCode.replace(/\s/g, ''),
                window: 1
            });

            if (!verified) {
                return sendError(res, 400, 'Invalid authenticator code');
            }

            // Check available balance
            const [balanceResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) as credits,
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) as debits
                FROM merchant_wallet_ledger 
                WHERE merchant_id = ? AND status = 'confirmed'
            `, [merchantId]);

            const balance = parseFloat(balanceResult[0]?.credits || 0) - parseFloat(balanceResult[0]?.debits || 0);

            if (amount > balance) {
                return sendError(res, 400, `Insufficient balance. Available: ₱${balance.toFixed(2)}`);
            }

            // Create withdrawal request
            const [result] = await db.execute(`
                INSERT INTO merchant_withdrawal_requests 
                (merchant_id, idempotency_key, amount, destination_type, destination_account, 
                 destination_name, pin_verified, otp_verified, status)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE, 'pending')
            `, [merchantId, idempotencyKey, amount, destinationType, destinationAccount, destinationName]);

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address, request_data)
                VALUES (?, 'withdrawal_requested', 'merchant', ?, ?, ?)
            `, [merchantId, merchantId, req.ip, JSON.stringify({ amount, destinationType, requestId: result.insertId })]);

            console.log(`[Wallet] Merchant #${merchantId} requested withdrawal #${result.insertId} for ₱${amount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Withdrawal request submitted. Processing within 24-48 hours.'
            });

        } catch (err) {
            console.error('Withdrawal error:', err);
            sendError(res, 500, 'Failed to process withdrawal', 'DB_ERROR', err);
        }
    });

    /**
     * GET /merchant/wallet/withdrawals - Get withdrawal history
     */
    apiRouter.get('/merchant/wallet/withdrawals', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.id;

            const [withdrawals] = await db.execute(`
                SELECT id, amount, destination_type, destination_account, destination_name,
                       status, failure_reason, created_at, processed_at
                FROM merchant_withdrawal_requests 
                WHERE merchant_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `, [merchantId]);

            sendSuccess(res, { withdrawals });

        } catch (err) {
            console.error('Withdrawals fetch error:', err);
            sendError(res, 500, 'Failed to fetch withdrawals', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 🔐 ADMIN WALLET API
    // ==========================================

    /**
     * Verify admin token middleware (enhanced for wallet operations)
     */
    const verifyAdminToken = (req, res, next) => {
        verifyToken(req, res, () => {
            // For now, we'll check if user role is 'admin' or 'merchant' with admin flag
            // In production, implement proper admin role checking
            const { role } = req.user;
            if (role !== 'admin' && role !== 'merchant') {
                return sendError(res, 403, 'Admin access required');
            }
            next();
        });
    };

    /**
     * GET /admin/wallet/requests - List all pending top-up requests
     */
    apiRouter.get('/admin/wallet/requests', verifyAdminToken, async (req, res) => {
        try {
            const status = req.query.status || 'pending';

            const [requests] = await db.execute(`
                SELECT r.id, r.merchant_id, r.amount, r.request_type, r.payment_method, 
                       r.payment_reference, r.proof_image_path, r.status, r.created_at,
                       m.name as merchant_name, m.email as merchant_email
                FROM merchant_topup_requests r
                JOIN merchants m ON r.merchant_id = m.id
                WHERE r.status = ?
                ORDER BY r.created_at ASC
            `, [status]);

            sendSuccess(res, { requests });

        } catch (err) {
            console.error('Admin requests fetch error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/requests/:id/approve - Approve top-up request with dual authorization
     */
    apiRouter.post('/admin/wallet/requests/:id/approve', verifyAdminToken, async (req, res) => {
        const conn = await db.execute('SELECT 1').then(() => null); // Get connection for transaction

        try {
            const requestId = req.params.id;
            const { systemKey, notes } = req.body;
            const adminId = req.user.id;

            // Verify system key (dual authorization)
            const expectedKey = process.env.WALLET_SYSTEM_KEY;
            if (!expectedKey || !systemKey) {
                return sendError(res, 400, 'System key is required for approval');
            }

            // Timing-safe comparison
            const keyBuffer = Buffer.from(systemKey);
            const expectedBuffer = Buffer.from(expectedKey);
            if (keyBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
                return sendError(res, 403, 'Invalid system key');
            }

            // Get request details
            const [requests] = await db.execute(
                'SELECT * FROM merchant_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed');
            }

            const request = requests[0];

            // Get previous hash for chain integrity
            const [lastEntry] = await db.execute(
                'SELECT entry_hash FROM merchant_wallet_ledger WHERE merchant_id = ? ORDER BY id DESC LIMIT 1',
                [request.merchant_id]
            );
            const prevHash = lastEntry.length > 0 ? lastEntry[0].entry_hash : '0'.repeat(64);

            // Calculate new running balance
            const [balanceResult] = await db.execute(`
                SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) as balance
                FROM merchant_wallet_ledger WHERE merchant_id = ? AND status = 'confirmed'
            `, [request.merchant_id]);
            const currentBalance = parseFloat(balanceResult[0]?.balance || 0);
            const newBalance = currentBalance + parseFloat(request.amount);

            // Create entry hash (includes previous hash for chain integrity)
            const entryData = `${request.merchant_id}:${request.amount}:credit:${request.idempotency_key}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(entryData).digest('hex');

            // Append ledger entry (immutable)
            await db.execute(`
                INSERT INTO merchant_wallet_ledger 
                (merchant_id, entry_type, transaction_type, amount, running_balance,
                 counterparty_type, counterparty_id, prev_hash, entry_hash, idempotency_key,
                 reference_type, reference_id, description, created_by_type, created_by_id)
                VALUES (?, 'credit', ?, ?, ?, 'hungr_bank', ?, ?, ?, ?, 'topup_request', ?, ?, 'admin', ?)
            `, [
                request.merchant_id,
                request.request_type,
                request.amount,
                newBalance,
                request.payment_reference || '',
                prevHash,
                entryHash,
                request.idempotency_key,
                requestId,
                `Top-up via ${request.payment_method}`,
                adminId
            ]);

            // Update request status
            await db.execute(`
                UPDATE merchant_topup_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, notes || '', requestId]);

            // Ensure wallet record exists
            await db.execute(`
                INSERT INTO merchant_wallets (merchant_id) VALUES (?)
                ON DUPLICATE KEY UPDATE updated_at = NOW()
            `, [request.merchant_id]);

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address, response_summary)
                VALUES (?, 'topup_approved', 'admin', ?, ?, ?)
            `, [request.merchant_id, adminId, req.ip, `Approved ₱${request.amount}, new balance: ₱${newBalance.toFixed(2)}`]);

            // Notify merchant via socket
            io.to(`merchant_${request.merchant_id}`).emit('wallet_updated', {
                type: 'topup_approved',
                amount: request.amount,
                newBalance: newBalance.toFixed(2)
            });

            console.log(`[Wallet] Admin #${adminId} approved top-up #${requestId} for ₱${request.amount}. New balance: ₱${newBalance.toFixed(2)}`);

            sendSuccess(res, {
                message: 'Top-up approved successfully',
                newBalance: newBalance.toFixed(2),
                entryHash
            });

        } catch (err) {
            console.error('Approval error:', err);
            sendError(res, 500, 'Failed to approve request', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/requests/:id/reject - Reject top-up request
     */
    apiRouter.post('/admin/wallet/requests/:id/reject', verifyAdminToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const { reason } = req.body;
            const adminId = req.user.id;

            // Get request
            const [requests] = await db.execute(
                'SELECT * FROM merchant_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed');
            }

            const request = requests[0];

            // Update status
            await db.execute(`
                UPDATE merchant_topup_requests 
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, reason || 'Rejected by admin', requestId]);

            // Log audit
            await db.execute(`
                INSERT INTO wallet_audit_log (merchant_id, action, actor_type, actor_id, ip_address, response_summary)
                VALUES (?, 'topup_rejected', 'admin', ?, ?, ?)
            `, [request.merchant_id, adminId, req.ip, `Rejected: ${reason || 'No reason provided'}`]);

            // Notify merchant
            io.to(`merchant_${request.merchant_id}`).emit('wallet_updated', {
                type: 'topup_rejected',
                requestId,
                reason: reason || 'Request rejected by admin'
            });

            console.log(`[Wallet] Admin #${adminId} rejected top-up #${requestId}`);

            sendSuccess(res, { message: 'Request rejected' });

        } catch (err) {
            console.error('Rejection error:', err);
            sendError(res, 500, 'Failed to reject request', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 👤 CUSTOMER WALLET API
    // ==========================================

    /**
     * GET /wallet - Get customer wallet info and balance
     */
    apiRouter.get('/wallet', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // Ensure wallet exists
            await db.execute(`
                INSERT IGNORE INTO customer_wallets (user_id) VALUES (?)
            `, [userId]);

            // Get wallet metadata
            const [walletRows] = await db.execute(
                'SELECT * FROM customer_wallets WHERE user_id = ?',
                [userId]
            );

            // Calculate balance from ledger
            const [balanceRow] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
                FROM customer_wallet_ledger WHERE user_id = ?
            `, [userId]);

            // Get recent transactions
            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, description, created_at
                FROM customer_wallet_ledger 
                WHERE user_id = ? AND status = 'confirmed'
                ORDER BY created_at DESC LIMIT 20
            `, [userId]);

            // Get pending requests
            const [pendingReqs] = await db.execute(`
                SELECT COUNT(*) as count FROM customer_topup_requests 
                WHERE user_id = ? AND status = 'pending'
            `, [userId]);

            sendSuccess(res, {
                wallet: walletRows[0],
                balance: balanceRow[0]?.balance || 0,
                transactions: transactions.map(tx => ({
                    id: tx.id,
                    type: tx.entry_type === 'credit' ? 'topup' : 'payment',
                    description: tx.description || tx.transaction_type,
                    amount: tx.amount,
                    created_at: tx.created_at
                })),
                pendingRequests: pendingReqs[0]?.count || 0
            });

        } catch (err) {
            console.error('Customer wallet error:', err);
            sendError(res, 500, 'Failed to fetch wallet', 'DB_ERROR', err);
        }
    });

    /**
     * GET /wallet/history - Get full transaction history for customer (paginated)
     */
    apiRouter.get('/wallet/history', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, running_balance, 
                       description, reference_id, status, created_at
                FROM customer_wallet_ledger 
                WHERE user_id = ? AND status = 'confirmed'
                ORDER BY created_at DESC LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            const [countResult] = await db.execute(`
                SELECT COUNT(*) as total FROM customer_wallet_ledger 
                WHERE user_id = ? AND status = 'confirmed'
            `, [userId]);

            sendSuccess(res, {
                transactions,
                total: countResult[0].total,
                page,
                limit
            });

        } catch (err) {
            console.error('Customer wallet history error:', err);
            sendError(res, 500, 'Failed to fetch history', 'DB_ERROR', err);
        }
    });

    /**
     * POST /wallet/topup - Submit customer top-up request
     */
    apiRouter.post('/wallet/topup', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { amount, paymentMethod, paymentReference, proofImage, idempotencyKey } = req.body;

            // Validation
            if (!amount || amount <= 0) {
                return sendError(res, 400, 'Invalid amount', 'VALIDATION_ERROR');
            }
            if (!paymentMethod) {
                return sendError(res, 400, 'Payment method required', 'VALIDATION_ERROR');
            }
            if (!proofImage) {
                return sendError(res, 400, 'Proof of payment required', 'VALIDATION_ERROR');
            }
            if (!idempotencyKey) {
                return sendError(res, 400, 'Idempotency key required', 'VALIDATION_ERROR');
            }

            // Check for duplicate request
            const [existing] = await db.execute(
                'SELECT id, status FROM customer_topup_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, {
                    requestId: existing[0].id,
                    status: existing[0].status,
                    message: 'Request already submitted'
                });
            }

            // Ensure wallet exists
            await db.execute(`INSERT IGNORE INTO customer_wallets (user_id) VALUES (?)`, [userId]);

            // Save proof image
            let proofPath = null;
            if (proofImage) {
                const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
                const filename = `customer_${userId}_${Date.now()}.png`;
                const filepath = path.join(proofUploadsDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                proofPath = `wallet-proofs/${filename}`;
            }

            // Create request
            const [result] = await db.execute(`
                INSERT INTO customer_topup_requests 
                (user_id, amount, payment_method, payment_reference, proof_image_path, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [userId, amount, paymentMethod, paymentReference || null, proofPath, idempotencyKey]);

            console.log(`[Wallet] Customer #${userId} submitted top-up request #${result.insertId} for ₱${amount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Top-up request submitted. Please wait for admin approval.'
            });

        } catch (err) {
            console.error('Customer top-up error:', err);
            sendError(res, 500, 'Failed to submit request', 'DB_ERROR', err);
        }
    });

    /**
     * GET /wallet/requests - Get customer's top-up request history
     */
    apiRouter.get('/wallet/requests', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const [requests] = await db.execute(`
                SELECT id, amount, payment_method, payment_reference, status, 
                       created_at, reviewed_at, rejection_reason
                FROM customer_topup_requests 
                WHERE user_id = ? 
                ORDER BY created_at DESC LIMIT 50
            `, [userId]);

            sendSuccess(res, { requests });

        } catch (err) {
            console.error('Customer requests error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * GET /admin/wallet/customer-requests - Get pending customer top-up requests (Admin)
     */
    apiRouter.get('/admin/wallet/customer-requests', verifyToken, async (req, res) => {
        try {
            const status = req.query.status || 'pending';

            const [requests] = await db.execute(`
                SELECT r.*, u.username as customer_name, u.email as customer_email, u.phone_number as customer_phone
                FROM customer_topup_requests r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.status = ?
                ORDER BY r.created_at ASC
            `, [status]);

            sendSuccess(res, { requests, type: 'customer' });

        } catch (err) {
            console.error('Admin customer requests error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/customer-requests/:id/approve - Approve customer top-up (Admin)
     */
    apiRouter.post('/admin/wallet/customer-requests/:id/approve', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { systemKey, notes } = req.body;

            // Dual authorization check
            if (systemKey !== process.env.WALLET_SYSTEM_KEY) {
                return sendError(res, 403, 'Invalid system key', 'AUTH_ERROR');
            }

            // Get request
            const [requests] = await db.execute(
                'SELECT * FROM customer_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed', 'NOT_FOUND');
            }

            const request = requests[0];
            const isRefund = request.request_type === 'refund';
            const payMethod = (request.payment_method || '').toLowerCase();
            const ledgerTable = (payMethod === 'coins' || payMethod === 'coin') ? 'customer_coin_ledger' : 'customer_wallet_ledger';
            const transactionType = isRefund ? 'refund' : 'topup';

            // Get previous ledger entry hash for chain
            const [lastEntry] = await db.execute(`
                SELECT entry_hash FROM ${ledgerTable} 
                WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `, [request.user_id]);

            const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
            const idempotencyKey = `${transactionType}_${requestId}_${Date.now()}`;

            // Calculate current balance
            const [balanceRow] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
                FROM ${ledgerTable} WHERE user_id = ?
            `, [request.user_id]);

            const currentBalance = parseFloat(balanceRow[0]?.balance || 0);
            const newBalance = currentBalance + parseFloat(request.amount);

            // Create entry hash
            const hashData = `${request.user_id}:${request.amount}:credit:${idempotencyKey}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

            // Insert ledger entry
            await db.execute(`
                INSERT INTO ${ledgerTable} 
                (user_id, entry_type, transaction_type, amount, running_balance, 
                 reference_id, description, idempotency_key, prev_hash, entry_hash, status)
                VALUES (?, 'credit', ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
            `, [
                request.user_id, transactionType, request.amount, newBalance,
                `${transactionType}_request_${requestId}`,
                isRefund ? `Refund for ${request.payment_reference || 'Order'}` : `Top-up via ${request.payment_method}`,
                idempotencyKey, prevHash, entryHash
            ]);

            // Update request status
            await db.execute(`
                UPDATE customer_topup_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, notes || (isRefund ? 'Auto-refund approved' : 'Approved via admin'), requestId]);

            sendSuccess(res, { requestId, newBalance: newBalance.toFixed(2) }, 'Request approved successfully');

        } catch (err) {
            console.error('Admin customer request approval error:', err);
            sendError(res, 500, 'Failed to process approval', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/customer-requests/:id/reject - Reject customer top-up (Admin)
     */
    apiRouter.post('/admin/wallet/customer-requests/:id/reject', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;

            const [requests] = await db.execute(
                'SELECT * FROM customer_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed', 'NOT_FOUND');
            }

            await db.execute(`
                UPDATE customer_topup_requests 
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
                WHERE id = ?
            `, [adminId, reason || 'No reason provided', requestId]);

            console.log(`[Wallet] Admin #${adminId} rejected customer top-up #${requestId}`);

            sendSuccess(res, { message: 'Request rejected' });

        } catch (err) {
            console.error('Customer rejection error:', err);
            sendError(res, 500, 'Failed to reject request', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 🏍️ RIDER WALLET API
    // ==========================================

    /**
     * GET /rider/wallet - Get rider wallet info and balance
     */
    apiRouter.get('/rider/wallet', verifyToken, async (req, res) => {
        try {
            const riderId = req.user.riderId || req.user.id;

            // Ensure wallet exists
            await db.execute(`INSERT IGNORE INTO rider_wallets (rider_id) VALUES (?)`, [riderId]);

            // Get wallet metadata
            const [walletRows] = await db.execute(
                'SELECT * FROM rider_wallets WHERE rider_id = ?',
                [riderId]
            );

            // Calculate balance from ledger
            const [balanceRow] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
                FROM rider_wallet_ledger WHERE rider_id = ?
            `, [riderId]);

            // Get recent transactions
            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, description, created_at
                FROM rider_wallet_ledger 
                WHERE rider_id = ? AND status = 'confirmed'
                ORDER BY created_at DESC LIMIT 20
            `, [riderId]);

            // Get pending requests
            const [pendingReqs] = await db.execute(`
                SELECT COUNT(*) as count FROM rider_topup_requests 
                WHERE rider_id = ? AND status = 'pending'
            `, [riderId]);

            sendSuccess(res, {
                wallet: walletRows[0],
                balance: balanceRow[0]?.balance || 0,
                transactions: transactions.map(tx => ({
                    id: tx.id,
                    type: tx.entry_type === 'credit' ? 'topup' : 'payment',
                    description: tx.description || tx.transaction_type,
                    amount: tx.amount,
                    created_at: tx.created_at
                })),
                pendingRequests: pendingReqs[0]?.count || 0
            });

        } catch (err) {
            console.error('Rider wallet error:', err);
            sendError(res, 500, 'Failed to fetch wallet', 'DB_ERROR', err);
        }
    });

    /**
     * POST /rider/wallet/topup - Submit rider top-up request
     */
    apiRouter.post('/rider/wallet/topup', verifyToken, async (req, res) => {
        try {
            const riderId = req.user.riderId || req.user.id;
            const { amount, paymentMethod, paymentReference, proofImage, idempotencyKey } = req.body;

            // Validation
            if (!amount || amount <= 0) {
                return sendError(res, 400, 'Invalid amount', 'VALIDATION_ERROR');
            }
            if (!paymentMethod) {
                return sendError(res, 400, 'Payment method required', 'VALIDATION_ERROR');
            }
            if (!proofImage) {
                return sendError(res, 400, 'Proof of payment required', 'VALIDATION_ERROR');
            }
            if (!idempotencyKey) {
                return sendError(res, 400, 'Idempotency key required', 'VALIDATION_ERROR');
            }

            // Check for duplicate request
            const [existing] = await db.execute(
                'SELECT id, status FROM rider_topup_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, {
                    requestId: existing[0].id,
                    status: existing[0].status,
                    message: 'Request already submitted'
                });
            }

            // Ensure wallet exists
            await db.execute(`INSERT IGNORE INTO rider_wallets (rider_id) VALUES (?)`, [riderId]);

            // Save proof image
            let proofPath = null;
            if (proofImage) {
                const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
                const filename = `rider_${riderId}_${Date.now()}.png`;
                const filepath = path.join(proofUploadsDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                proofPath = `wallet-proofs/${filename}`;
            }

            // Create request
            const [result] = await db.execute(`
                INSERT INTO rider_topup_requests 
                (rider_id, amount, payment_method, payment_reference, proof_image_path, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [riderId, amount, paymentMethod, paymentReference || null, proofPath, idempotencyKey]);

            console.log(`[Wallet] Rider #${riderId} submitted top-up request #${result.insertId} for ₱${amount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Top-up request submitted. Please wait for admin approval.'
            });

        } catch (err) {
            console.error('Rider top-up error:', err);
            sendError(res, 500, 'Failed to submit request', 'DB_ERROR', err);
        }
    });

    /**
     * GET /admin/wallet/rider-requests - Get pending rider top-up requests (Admin)
     */
    apiRouter.get('/admin/wallet/rider-requests', verifyToken, async (req, res) => {
        try {
            const status = req.query.status || 'pending';

            const [requests] = await db.execute(`
                SELECT r.*, rd.name as rider_name, rd.email as rider_email, rd.phone_number as rider_phone
                FROM rider_topup_requests r
                LEFT JOIN riders rd ON r.rider_id = rd.id
                WHERE r.status = ?
                ORDER BY r.created_at ASC
            `, [status]);

            sendSuccess(res, { requests, type: 'rider' });

        } catch (err) {
            console.error('Admin rider requests error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/rider-requests/:id/approve - Approve rider top-up (Admin)
     */
    apiRouter.post('/admin/wallet/rider-requests/:id/approve', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { systemKey, notes } = req.body;

            // Dual authorization check
            if (systemKey !== process.env.WALLET_SYSTEM_KEY) {
                return sendError(res, 403, 'Invalid system key', 'AUTH_ERROR');
            }

            // Get request
            const [requests] = await db.execute(
                'SELECT * FROM rider_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed', 'NOT_FOUND');
            }

            const request = requests[0];

            // Get previous ledger entry hash for chain
            const [lastEntry] = await db.execute(`
                SELECT entry_hash FROM rider_wallet_ledger 
                WHERE rider_id = ? ORDER BY id DESC LIMIT 1
            `, [request.rider_id]);

            const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
            const idempotencyKey = `topup_${requestId}_${Date.now()}`;

            // Calculate new balance
            const [balanceRow] = await db.execute(`
                SELECT 
                    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN entry_type = 'debit' AND status = 'confirmed' THEN amount ELSE 0 END), 0) AS balance
                FROM rider_wallet_ledger WHERE rider_id = ?
            `, [request.rider_id]);

            const currentBalance = parseFloat(balanceRow[0]?.balance || 0);
            const newBalance = currentBalance + parseFloat(request.amount);

            // Create entry hash
            const hashData = `${request.rider_id}:${request.amount}:credit:${idempotencyKey}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

            // Insert ledger entry
            await db.execute(`
                INSERT INTO rider_wallet_ledger 
                (rider_id, entry_type, transaction_type, amount, running_balance, 
                 reference_id, description, idempotency_key, prev_hash, entry_hash, status)
                VALUES (?, 'credit', 'topup', ?, ?, ?, ?, ?, ?, ?, 'confirmed')
            `, [
                request.rider_id, request.amount, newBalance,
                `topup_request_${requestId}`,
                `Top-up via ${request.payment_method}`,
                idempotencyKey, prevHash, entryHash
            ]);

            // Update request status
            await db.execute(`
                UPDATE rider_topup_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, notes || null, requestId]);

            console.log(`[Wallet] Admin #${adminId} approved rider top-up #${requestId}`);

            sendSuccess(res, {
                message: 'Rider top-up approved',
                newBalance: newBalance.toFixed(2),
                entryHash
            });

        } catch (err) {
            console.error('Rider approval error:', err);
            sendError(res, 500, 'Failed to approve request', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/wallet/rider-requests/:id/reject - Reject rider top-up (Admin)
     */
    apiRouter.post('/admin/wallet/rider-requests/:id/reject', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;

            const [requests] = await db.execute(
                'SELECT * FROM rider_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );

            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed', 'NOT_FOUND');
            }

            await db.execute(`
                UPDATE rider_topup_requests 
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
                WHERE id = ?
            `, [adminId, reason || 'No reason provided', requestId]);

            console.log(`[Wallet] Admin #${adminId} rejected rider top-up #${requestId}`);

            sendSuccess(res, { message: 'Request rejected' });

        } catch (err) {
            console.error('Rider rejection error:', err);
            sendError(res, 500, 'Failed to reject request', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 👤 RIDER PROFILE API
    // ==========================================

    /**
     * GET /rider/profile - Get rider profile data
     */
    apiRouter.get('/rider/profile', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const [riders] = await db.execute(`
                SELECT id, user_id, name, first_name, last_name, middle_name, 
                       email, phone, address, profile_photo, biography,
                       vehicle_type, plate_number, ratings, completed_orders
                FROM riders WHERE user_id = ?
            `, [userId]);

            if (riders.length === 0) {
                return sendError(res, 404, 'Rider profile not found', 'NOT_FOUND');
            }

            sendSuccess(res, riders[0]);

        } catch (err) {
            console.error('Get rider profile error:', err);
            sendError(res, 500, 'Failed to get profile', 'DB_ERROR', err);
        }
    });

    /**
     * PUT /rider/profile - Update rider profile
     */
    apiRouter.put('/rider/profile', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { first_name, last_name, middle_name, phone, address, biography } = req.body;

            // Validate inputs
            if (!first_name || !last_name) {
                return sendError(res, 400, 'First name and last name are required');
            }

            // Update rider profile
            const fullName = middle_name
                ? `${first_name} ${middle_name} ${last_name}`
                : `${first_name} ${last_name}`;

            await db.execute(`
                UPDATE riders 
                SET first_name = ?, last_name = ?, middle_name = ?, 
                    name = ?, phone = ?, address = ?, biography = ?, updated_at = NOW()
                WHERE user_id = ?
            `, [first_name, last_name, middle_name || null, fullName, phone, address, biography, userId]);

            console.log(`[Profile] Rider #${userId} updated profile`);

            sendSuccess(res, { message: 'Profile updated successfully' });

        } catch (err) {
            console.error('Update rider profile error:', err);
            sendError(res, 500, 'Failed to update profile', 'DB_ERROR', err);
        }
    });

    /**
     * POST /rider/profile/photo - Upload rider profile photo
     */
    apiRouter.post('/rider/profile/photo', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { photo } = req.body; // Base64 encoded image

            if (!photo) {
                return sendError(res, 400, 'Photo is required');
            }

            // Save photo to uploads folder
            const photoDir = path.join(process.cwd(), 'uploads', 'rider-photos');
            if (!fs.existsSync(photoDir)) {
                fs.mkdirSync(photoDir, { recursive: true });
            }

            // Extract base64 data
            const matches = photo.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                return sendError(res, 400, 'Invalid image format');
            }

            const ext = matches[1];
            const data = matches[2];
            const filename = `rider-${userId}-${Date.now()}.${ext}`;
            const filepath = path.join(photoDir, filename);

            fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

            const photoUrl = `/uploads/rider-photos/${filename}`;

            // Update database
            await db.execute(`
                UPDATE riders SET profile_photo = ?, updated_at = NOW() WHERE user_id = ?
            `, [photoUrl, userId]);

            console.log(`[Profile] Rider #${userId} uploaded photo: ${photoUrl}`);

            sendSuccess(res, { photoUrl });

        } catch (err) {
            console.error('Upload rider photo error:', err);
            sendError(res, 500, 'Failed to upload photo', 'DB_ERROR', err);
        }
    });

    /**
     * POST /rider/password/reset - Reset rider password
     */
    apiRouter.post('/rider/password/reset', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return sendError(res, 400, 'Current password and new password are required');
            }

            if (newPassword.length < 6) {
                return sendError(res, 400, 'New password must be at least 6 characters');
            }

            // Get user's current password hash
            const [users] = await db.execute(`
                SELECT password_hash FROM users WHERE id = ?
            `, [userId]);

            if (users.length === 0) {
                return sendError(res, 404, 'User not found', 'NOT_FOUND');
            }

            // Verify current password (using bcrypt)
            const bcrypt = await import('bcryptjs');
            const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);

            if (!isValid) {
                return sendError(res, 401, 'Current password is incorrect');
            }

            // Hash new password
            const newHash = await bcrypt.hash(newPassword, 10);

            // Update password
            await db.execute(`
                UPDATE users SET password_hash = ? WHERE id = ?
            `, [newHash, userId]);

            console.log(`[Profile] Rider #${userId} changed password`);

            sendSuccess(res, { message: 'Password changed successfully' });

        } catch (err) {
            console.error('Password reset error:', err);
            sendError(res, 500, 'Failed to reset password', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // 🪙 HUNGR COINS API
    // ==========================================

    // Helper: Calculate coin balance from ledger
    const getCoinBalance = async (tableName, idField, id) => {
        const [rows] = await db.execute(`
            SELECT 
                COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) AS balance
            FROM ${tableName} WHERE ${idField} = ?
        `, [id]);
        return parseInt(rows[0]?.balance || 0);
    };

    // ==========================================
    // MERCHANT COINS
    // ==========================================

    /**
     * GET /merchant/coins - Get merchant coin balance and history
     */
    apiRouter.get('/merchant/coins', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.merchantId;
            if (!merchantId) return sendError(res, 403, 'Merchant access required');

            // Ensure coins record exists
            await db.execute(`INSERT IGNORE INTO merchant_coins (merchant_id) VALUES (?)`, [merchantId]);

            const balance = await getCoinBalance('merchant_coin_ledger', 'merchant_id', merchantId);

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, description, recipient_user_id, created_at
                FROM merchant_coin_ledger 
                WHERE merchant_id = ?
                ORDER BY created_at DESC LIMIT 30
            `, [merchantId]);

            const [pendingReqs] = await db.execute(`
                SELECT COUNT(*) as count FROM merchant_coin_topup_requests 
                WHERE merchant_id = ? AND status = 'pending'
            `, [merchantId]);

            sendSuccess(res, {
                balance,
                transactions,
                pendingRequests: pendingReqs[0]?.count || 0
            });

        } catch (err) {
            console.error('Merchant coins error:', err);
            sendError(res, 500, 'Failed to fetch coins', 'DB_ERROR', err);
        }
    });

    /**
     * POST /merchant/coins/topup - Request to buy coins
     */
    apiRouter.post('/merchant/coins/topup', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.merchantId;
            if (!merchantId) return sendError(res, 403, 'Merchant access required');

            const { coinAmount, pesoAmount, paymentMethod, paymentReference, proofImage, idempotencyKey } = req.body;

            if (!coinAmount || coinAmount <= 0) return sendError(res, 400, 'Invalid coin amount');
            if (!pesoAmount || pesoAmount <= 0) return sendError(res, 400, 'Invalid peso amount');
            if (!paymentMethod) return sendError(res, 400, 'Payment method required');
            if (!proofImage) return sendError(res, 400, 'Proof of payment required');
            if (!idempotencyKey) return sendError(res, 400, 'Idempotency key required');

            // Check duplicate
            const [existing] = await db.execute(
                'SELECT id, status FROM merchant_coin_topup_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, { requestId: existing[0].id, status: existing[0].status, message: 'Request already submitted' });
            }

            // Ensure coins record exists
            await db.execute(`INSERT IGNORE INTO merchant_coins (merchant_id) VALUES (?)`, [merchantId]);

            // Save proof image
            let proofPath = null;
            if (proofImage) {
                const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
                const filename = `merchant_coin_${merchantId}_${Date.now()}.png`;
                const filepath = path.join(proofUploadsDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                proofPath = `wallet-proofs/${filename}`;
            }

            const [result] = await db.execute(`
                INSERT INTO merchant_coin_topup_requests 
                (merchant_id, amount, peso_amount, payment_method, payment_reference, proof_image_path, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [merchantId, coinAmount, pesoAmount, paymentMethod, paymentReference || null, proofPath, idempotencyKey]);

            console.log(`[Coins] Merchant #${merchantId} requested ${coinAmount} coins for ₱${pesoAmount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Coin purchase request submitted. Awaiting admin approval.'
            });

        } catch (err) {
            console.error('Merchant coin topup error:', err);
            sendError(res, 500, 'Failed to submit request', 'DB_ERROR', err);
        }
    });

    /**
     * POST /merchant/coins/award - Award coins to a customer
     */
    apiRouter.post('/merchant/coins/award', verifyToken, async (req, res) => {
        try {
            const merchantId = req.user.merchantId;
            if (!merchantId) return sendError(res, 403, 'Merchant access required');

            const { customerEmail, amount, reason, actionCode } = req.body;

            if (!customerEmail) return sendError(res, 400, 'Customer email required');
            if (!amount || amount <= 0) return sendError(res, 400, 'Invalid amount');

            // Find customer
            const [customers] = await db.execute('SELECT id FROM users WHERE email = ?', [customerEmail]);
            if (customers.length === 0) return sendError(res, 404, 'Customer not found');
            const customerId = customers[0].id;

            // Check merchant has enough coins
            const merchantBalance = await getCoinBalance('merchant_coin_ledger', 'merchant_id', merchantId);
            if (merchantBalance < amount) {
                return sendError(res, 400, `Insufficient coins. You have ${merchantBalance} coins.`);
            }

            // Debit merchant
            const [lastMerchantEntry] = await db.execute(`
                SELECT entry_hash FROM merchant_coin_ledger WHERE merchant_id = ? ORDER BY id DESC LIMIT 1
            `, [merchantId]);
            const merchantPrevHash = lastMerchantEntry[0]?.entry_hash || '0'.repeat(64);
            const merchantIdempKey = `award_${merchantId}_${customerId}_${Date.now()}`;
            const merchantNewBalance = merchantBalance - amount;
            const merchantHashData = `${merchantId}:${amount}:debit:${merchantIdempKey}:${merchantPrevHash}`;
            const merchantEntryHash = crypto.createHash('sha256').update(merchantHashData).digest('hex');

            await db.execute(`
                INSERT INTO merchant_coin_ledger 
                (merchant_id, entry_type, transaction_type, amount, running_balance, recipient_user_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'debit', 'award', ?, ?, ?, ?, ?, ?, ?)
            `, [merchantId, amount, merchantNewBalance, customerId, reason || 'Coins awarded to customer', merchantIdempKey, merchantPrevHash, merchantEntryHash]);

            // Credit customer
            const [lastCustomerEntry] = await db.execute(`
                SELECT entry_hash FROM customer_coin_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `, [customerId]);
            const customerPrevHash = lastCustomerEntry[0]?.entry_hash || '0'.repeat(64);
            const customerIdempKey = `receive_${merchantId}_${customerId}_${Date.now()}`;
            const customerBalance = await getCoinBalance('customer_coin_ledger', 'user_id', customerId);
            const customerNewBalance = customerBalance + amount;
            const customerHashData = `${customerId}:${amount}:credit:${customerIdempKey}:${customerPrevHash}`;
            const customerEntryHash = crypto.createHash('sha256').update(customerHashData).digest('hex');

            await db.execute(`
                INSERT INTO customer_coin_ledger 
                (user_id, entry_type, transaction_type, amount, running_balance, source_type, source_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'credit', 'award', ?, ?, 'merchant', ?, ?, ?, ?, ?)
            `, [customerId, amount, customerNewBalance, merchantId, reason || 'Coins from merchant', customerIdempKey, customerPrevHash, customerEntryHash]);

            // Record transfer
            await db.execute(`
                INSERT INTO coin_transfers (from_type, from_id, to_user_id, amount, reason, action_code)
                VALUES ('merchant', ?, ?, ?, ?, ?)
            `, [merchantId, customerId, amount, reason, actionCode || null]);

            console.log(`[Coins] Merchant #${merchantId} awarded ${amount} coins to user #${customerId}`);

            sendSuccess(res, {
                message: `Successfully awarded ${amount} coins to ${customerEmail}`,
                merchantBalance: merchantNewBalance,
                customerBalance: customerNewBalance
            });

        } catch (err) {
            console.error('Merchant coin award error:', err);
            sendError(res, 500, 'Failed to award coins', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // RIDER COINS
    // ==========================================

    /**
     * GET /rider/coins - Get rider coin balance and history
     */
    apiRouter.get('/rider/coins', verifyToken, async (req, res) => {
        try {
            const riderId = req.user.riderId || req.user.id;

            await db.execute(`INSERT IGNORE INTO rider_coins (rider_id) VALUES (?)`, [riderId]);

            const balance = await getCoinBalance('rider_coin_ledger', 'rider_id', riderId);

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, description, recipient_user_id, created_at
                FROM rider_coin_ledger 
                WHERE rider_id = ?
                ORDER BY created_at DESC LIMIT 30
            `, [riderId]);

            const [pendingReqs] = await db.execute(`
                SELECT COUNT(*) as count FROM rider_coin_topup_requests 
                WHERE rider_id = ? AND status = 'pending'
            `, [riderId]);

            sendSuccess(res, {
                balance,
                transactions,
                pendingRequests: pendingReqs[0]?.count || 0
            });

        } catch (err) {
            console.error('Rider coins error:', err);
            sendError(res, 500, 'Failed to fetch coins', 'DB_ERROR', err);
        }
    });

    /**
     * POST /rider/coins/topup - Request to buy coins
     */
    apiRouter.post('/rider/coins/topup', verifyToken, async (req, res) => {
        try {
            const riderId = req.user.riderId || req.user.id;
            const { coinAmount, pesoAmount, paymentMethod, paymentReference, proofImage, idempotencyKey } = req.body;

            if (!coinAmount || coinAmount <= 0) return sendError(res, 400, 'Invalid coin amount');
            if (!pesoAmount || pesoAmount <= 0) return sendError(res, 400, 'Invalid peso amount');
            if (!paymentMethod) return sendError(res, 400, 'Payment method required');
            if (!proofImage) return sendError(res, 400, 'Proof of payment required');
            if (!idempotencyKey) return sendError(res, 400, 'Idempotency key required');

            const [existing] = await db.execute(
                'SELECT id, status FROM rider_coin_topup_requests WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, { requestId: existing[0].id, status: existing[0].status, message: 'Request already submitted' });
            }

            await db.execute(`INSERT IGNORE INTO rider_coins (rider_id) VALUES (?)`, [riderId]);

            let proofPath = null;
            if (proofImage) {
                const base64Data = proofImage.replace(/^data:image\/\w+;base64,/, '');
                const filename = `rider_coin_${riderId}_${Date.now()}.png`;
                const filepath = path.join(proofUploadsDir, filename);
                fs.writeFileSync(filepath, base64Data, 'base64');
                proofPath = `wallet-proofs/${filename}`;
            }

            const [result] = await db.execute(`
                INSERT INTO rider_coin_topup_requests 
                (rider_id, amount, peso_amount, payment_method, payment_reference, proof_image_path, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [riderId, coinAmount, pesoAmount, paymentMethod, paymentReference || null, proofPath, idempotencyKey]);

            console.log(`[Coins] Rider #${riderId} requested ${coinAmount} coins for ₱${pesoAmount}`);

            sendSuccess(res, {
                requestId: result.insertId,
                status: 'pending',
                message: 'Coin purchase request submitted. Awaiting admin approval.'
            });

        } catch (err) {
            console.error('Rider coin topup error:', err);
            sendError(res, 500, 'Failed to submit request', 'DB_ERROR', err);
        }
    });

    /**
     * POST /rider/coins/award - Award coins to customer (e.g., after 5-star feedback)
     */
    apiRouter.post('/rider/coins/award', verifyToken, async (req, res) => {
        try {
            const riderId = req.user.riderId || req.user.id;
            const { customerId, amount, reason } = req.body;

            if (!customerId) return sendError(res, 400, 'Customer ID required');
            if (!amount || amount <= 0) return sendError(res, 400, 'Invalid amount');

            const riderBalance = await getCoinBalance('rider_coin_ledger', 'rider_id', riderId);
            if (riderBalance < amount) {
                return sendError(res, 400, `Insufficient coins. You have ${riderBalance} coins.`);
            }

            // Debit rider
            const [lastRiderEntry] = await db.execute(`
                SELECT entry_hash FROM rider_coin_ledger WHERE rider_id = ? ORDER BY id DESC LIMIT 1
            `, [riderId]);
            const riderPrevHash = lastRiderEntry[0]?.entry_hash || '0'.repeat(64);
            const riderIdempKey = `award_${riderId}_${customerId}_${Date.now()}`;
            const riderNewBalance = riderBalance - amount;
            const riderHashData = `${riderId}:${amount}:debit:${riderIdempKey}:${riderPrevHash}`;
            const riderEntryHash = crypto.createHash('sha256').update(riderHashData).digest('hex');

            await db.execute(`
                INSERT INTO rider_coin_ledger 
                (rider_id, entry_type, transaction_type, amount, running_balance, recipient_user_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'debit', 'award', ?, ?, ?, ?, ?, ?, ?)
            `, [riderId, amount, riderNewBalance, customerId, reason || '5-star feedback reward', riderIdempKey, riderPrevHash, riderEntryHash]);

            // Credit customer
            const [lastCustomerEntry] = await db.execute(`
                SELECT entry_hash FROM customer_coin_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `, [customerId]);
            const customerPrevHash = lastCustomerEntry[0]?.entry_hash || '0'.repeat(64);
            const customerIdempKey = `receive_rider_${riderId}_${customerId}_${Date.now()}`;
            const customerBalance = await getCoinBalance('customer_coin_ledger', 'user_id', customerId);
            const customerNewBalance = customerBalance + amount;
            const customerHashData = `${customerId}:${amount}:credit:${customerIdempKey}:${customerPrevHash}`;
            const customerEntryHash = crypto.createHash('sha256').update(customerHashData).digest('hex');

            await db.execute(`
                INSERT INTO customer_coin_ledger 
                (user_id, entry_type, transaction_type, amount, running_balance, source_type, source_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'credit', 'award', ?, ?, 'rider', ?, ?, ?, ?, ?)
            `, [customerId, amount, customerNewBalance, riderId, reason || '5-star feedback reward', customerIdempKey, customerPrevHash, customerEntryHash]);

            // Record transfer
            await db.execute(`
                INSERT INTO coin_transfers (from_type, from_id, to_user_id, amount, reason, action_code)
                VALUES ('rider', ?, ?, ?, ?, 'five_star_feedback')
            `, [riderId, customerId, amount, reason]);

            console.log(`[Coins] Rider #${riderId} awarded ${amount} coins to user #${customerId}`);

            sendSuccess(res, {
                message: `Successfully awarded ${amount} coins`,
                riderBalance: riderNewBalance
            });

        } catch (err) {
            console.error('Rider coin award error:', err);
            sendError(res, 500, 'Failed to award coins', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // CUSTOMER COINS (Enhanced)
    // ==========================================

    /**
     * GET /coins - Get customer coin balance and history (enhanced)
     */
    apiRouter.get('/coins', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const balance = await getCoinBalance('customer_coin_ledger', 'user_id', userId);

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, source_type, description, created_at
                FROM customer_coin_ledger 
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 30
            `, [userId]);

            // Get earning rules for display
            const [rules] = await db.execute(`
                SELECT action_code, description, coin_amount, source_type 
                FROM coin_earning_rules 
                WHERE is_active = TRUE
                ORDER BY coin_amount DESC
            `);

            sendSuccess(res, {
                balance,
                transactions,
                earningRules: rules
            });

        } catch (err) {
            console.error('Customer coins error:', err);
            sendError(res, 500, 'Failed to fetch coins', 'DB_ERROR', err);
        }
    });

    /**
     * GET /coins/history - Get full coin transaction history (paginated)
     */
    apiRouter.get('/coins/history', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const [transactions] = await db.execute(`
                SELECT id, entry_type, transaction_type, amount, running_balance, 
                       description, created_at
                FROM customer_coin_ledger 
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            const [countResult] = await db.execute(`
                SELECT COUNT(*) as total FROM customer_coin_ledger 
                WHERE user_id = ?
            `, [userId]);

            sendSuccess(res, {
                transactions,
                total: countResult[0].total,
                page,
                limit
            });

        } catch (err) {
            console.error('Customer coins history error:', err);
            sendError(res, 500, 'Failed to fetch coins history', 'DB_ERROR', err);
        }
    });

    /**
     * POST /coins/earn - System-triggered coin earning
     */
    apiRouter.post('/coins/earn', verifyToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { actionCode, orderId } = req.body;

            if (!actionCode) return sendError(res, 400, 'Action code required');

            // Get earning rule
            const [rules] = await db.execute(
                'SELECT * FROM coin_earning_rules WHERE action_code = ? AND is_active = TRUE',
                [actionCode]
            );
            if (rules.length === 0) {
                return sendError(res, 400, 'Invalid or inactive action code');
            }

            const rule = rules[0];
            const amount = rule.coin_amount;
            const idempotencyKey = `earn_${userId}_${actionCode}_${orderId || Date.now()}`;

            // Check if already earned for this action
            const [existing] = await db.execute(
                'SELECT id FROM customer_coin_ledger WHERE idempotency_key = ?',
                [idempotencyKey]
            );
            if (existing.length > 0) {
                return sendSuccess(res, { message: 'Coins already earned for this action', alreadyEarned: true });
            }

            // Credit customer
            const [lastEntry] = await db.execute(`
                SELECT entry_hash FROM customer_coin_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `, [userId]);
            const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
            const currentBalance = await getCoinBalance('customer_coin_ledger', 'user_id', userId);
            const newBalance = currentBalance + amount;
            const hashData = `${userId}:${amount}:credit:${idempotencyKey}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

            await db.execute(`
                INSERT INTO customer_coin_ledger 
                (user_id, entry_type, transaction_type, amount, running_balance, source_type, reference_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'credit', 'earn', ?, ?, 'system', ?, ?, ?, ?, ?)
            `, [userId, amount, newBalance, orderId || null, rule.description, idempotencyKey, prevHash, entryHash]);

            // Record transfer
            await db.execute(`
                INSERT INTO coin_transfers (from_type, from_id, to_user_id, amount, reason, action_code, order_id)
                VALUES ('system', NULL, ?, ?, ?, ?, ?)
            `, [userId, amount, rule.description, actionCode, orderId || null]);

            console.log(`[Coins] User #${userId} earned ${amount} coins for ${actionCode}`);

            sendSuccess(res, {
                message: `You earned ${amount} coins!`,
                amount,
                newBalance,
                actionCode
            });

        } catch (err) {
            console.error('Coin earn error:', err);
            sendError(res, 500, 'Failed to earn coins', 'DB_ERROR', err);
        }
    });

    // ==========================================
    // ADMIN COIN APPROVAL ENDPOINTS
    // ==========================================

    /**
     * GET /admin/coins/merchant-requests - Get merchant coin purchase requests
     */
    apiRouter.get('/admin/coins/merchant-requests', verifyToken, async (req, res) => {
        try {
            const status = req.query.status || 'pending';
            const [requests] = await db.execute(`
                SELECT r.*, m.name as merchant_name, m.email as merchant_email
                FROM merchant_coin_topup_requests r
                LEFT JOIN merchants m ON r.merchant_id = m.id
                WHERE r.status = ?
                ORDER BY r.created_at ASC
            `, [status]);

            sendSuccess(res, { requests, type: 'merchant_coins' });
        } catch (err) {
            console.error('Admin merchant coin requests error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * GET /admin/coins/rider-requests - Get rider coin purchase requests
     */
    apiRouter.get('/admin/coins/rider-requests', verifyToken, async (req, res) => {
        try {
            const status = req.query.status || 'pending';
            const [requests] = await db.execute(`
                SELECT r.*, rd.name as rider_name, rd.email as rider_email
                FROM rider_coin_topup_requests r
                LEFT JOIN riders rd ON r.rider_id = rd.id
                WHERE r.status = ?
                ORDER BY r.created_at ASC
            `, [status]);

            sendSuccess(res, { requests, type: 'rider_coins' });
        } catch (err) {
            console.error('Admin rider coin requests error:', err);
            sendError(res, 500, 'Failed to fetch requests', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/coins/merchant-requests/:id/approve - Approve merchant coin purchase
     */
    apiRouter.post('/admin/coins/merchant-requests/:id/approve', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { systemKey, notes } = req.body;

            if (systemKey !== process.env.WALLET_SYSTEM_KEY) {
                return sendError(res, 403, 'Invalid system key', 'AUTH_ERROR');
            }

            const [requests] = await db.execute(
                'SELECT * FROM merchant_coin_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );
            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed');
            }

            const request = requests[0];

            // Get previous hash
            const [lastEntry] = await db.execute(`
                SELECT entry_hash FROM merchant_coin_ledger WHERE merchant_id = ? ORDER BY id DESC LIMIT 1
            `, [request.merchant_id]);
            const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
            const idempotencyKey = `topup_coin_${requestId}_${Date.now()}`;
            const currentBalance = await getCoinBalance('merchant_coin_ledger', 'merchant_id', request.merchant_id);
            const newBalance = currentBalance + request.amount;

            const hashData = `${request.merchant_id}:${request.amount}:credit:${idempotencyKey}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

            await db.execute(`
                INSERT INTO merchant_coin_ledger 
                (merchant_id, entry_type, transaction_type, amount, running_balance, reference_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'credit', 'topup', ?, ?, ?, ?, ?, ?, ?)
            `, [request.merchant_id, request.amount, newBalance, `coin_topup_${requestId}`, `Purchased ${request.amount} coins for ₱${request.peso_amount}`, idempotencyKey, prevHash, entryHash]);

            await db.execute(`
                UPDATE merchant_coin_topup_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, notes || null, requestId]);

            console.log(`[Coins] Admin approved merchant coin purchase #${requestId}`);

            sendSuccess(res, { message: 'Coin purchase approved', newBalance });
        } catch (err) {
            console.error('Merchant coin approval error:', err);
            sendError(res, 500, 'Failed to approve', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/coins/rider-requests/:id/approve - Approve rider coin purchase
     */
    apiRouter.post('/admin/coins/rider-requests/:id/approve', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { systemKey, notes } = req.body;

            if (systemKey !== process.env.WALLET_SYSTEM_KEY) {
                return sendError(res, 403, 'Invalid system key', 'AUTH_ERROR');
            }

            const [requests] = await db.execute(
                'SELECT * FROM rider_coin_topup_requests WHERE id = ? AND status = ?',
                [requestId, 'pending']
            );
            if (requests.length === 0) {
                return sendError(res, 404, 'Request not found or already processed');
            }

            const request = requests[0];

            const [lastEntry] = await db.execute(`
                SELECT entry_hash FROM rider_coin_ledger WHERE rider_id = ? ORDER BY id DESC LIMIT 1
            `, [request.rider_id]);
            const prevHash = lastEntry[0]?.entry_hash || '0'.repeat(64);
            const idempotencyKey = `topup_coin_${requestId}_${Date.now()}`;
            const currentBalance = await getCoinBalance('rider_coin_ledger', 'rider_id', request.rider_id);
            const newBalance = currentBalance + request.amount;

            const hashData = `${request.rider_id}:${request.amount}:credit:${idempotencyKey}:${prevHash}`;
            const entryHash = crypto.createHash('sha256').update(hashData).digest('hex');

            await db.execute(`
                INSERT INTO rider_coin_ledger 
                (rider_id, entry_type, transaction_type, amount, running_balance, reference_id, description, idempotency_key, prev_hash, entry_hash)
                VALUES (?, 'credit', 'topup', ?, ?, ?, ?, ?, ?, ?)
            `, [request.rider_id, request.amount, newBalance, `coin_topup_${requestId}`, `Purchased ${request.amount} coins for ₱${request.peso_amount}`, idempotencyKey, prevHash, entryHash]);

            await db.execute(`
                UPDATE rider_coin_topup_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
                WHERE id = ?
            `, [adminId, notes || null, requestId]);

            console.log(`[Coins] Admin approved rider coin purchase #${requestId}`);

            sendSuccess(res, { message: 'Coin purchase approved', newBalance });
        } catch (err) {
            console.error('Rider coin approval error:', err);
            sendError(res, 500, 'Failed to approve', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/coins/merchant-requests/:id/reject - Reject merchant coin purchase
     */
    apiRouter.post('/admin/coins/merchant-requests/:id/reject', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;

            await db.execute(`
                UPDATE merchant_coin_topup_requests 
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
                WHERE id = ? AND status = 'pending'
            `, [adminId, reason || 'No reason provided', requestId]);

            sendSuccess(res, { message: 'Request rejected' });
        } catch (err) {
            console.error('Merchant coin rejection error:', err);
            sendError(res, 500, 'Failed to reject', 'DB_ERROR', err);
        }
    });

    /**
     * POST /admin/coins/rider-requests/:id/reject - Reject rider coin purchase
     */
    apiRouter.post('/admin/coins/rider-requests/:id/reject', verifyToken, async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;

            await db.execute(`
                UPDATE rider_coin_topup_requests 
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
                WHERE id = ? AND status = 'pending'
            `, [adminId, reason || 'No reason provided', requestId]);

            sendSuccess(res, { message: 'Request rejected' });
        } catch (err) {
            console.error('Rider coin rejection error:', err);
            sendError(res, 500, 'Failed to reject', 'DB_ERROR', err);
        }
    });

    console.log('💰 Merchant Wallet API routes registered');
    console.log('👤 Customer Wallet API routes registered');
    console.log('🏍️ Rider Wallet API routes registered');
    console.log('🪙 Hungr Coins API routes registered');
}
