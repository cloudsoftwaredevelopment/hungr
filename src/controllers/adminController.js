import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const createMerchant = async (req, res) => {
    try {
        const { email, businessName, businessType, password, adminKey } = req.body;

        // Verify admin key (simple security - you can enhance this)
        const ADMIN_KEY = env.WALLET_SYSTEM_KEY;
        if (adminKey !== ADMIN_KEY) {
            return sendError(res, 401, 'Invalid admin key');
        }

        // Validate required fields
        if (!email || !businessName || !businessType || !password) {
            return sendError(res, 400, 'Missing required fields: email, businessName, businessType, password');
        }

        if (!['restaurant', 'store'].includes(businessType)) {
            return sendError(res, 400, 'businessType must be "restaurant" or "store"');
        }

        // Check if email already exists
        const [existingMerchants] = await db.execute('SELECT id FROM merchants WHERE email = ?', [email]);
        if (existingMerchants.length > 0) {
            return sendError(res, 409, 'A merchant with this email already exists');
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create restaurant or store entry first
        let businessId;
        if (businessType === 'restaurant') {
            const [result] = await db.execute(
                'INSERT INTO restaurants (name, cuisine_type, rating, is_available) VALUES (?, ?, 5.0, 0)',
                [businessName, 'General']
            );
            businessId = result.insertId;
        } else {
            // Store - check if stores table exists, if not just continue without store_id
            try {
                const [result] = await db.execute(
                    'INSERT INTO stores (name, is_available) VALUES (?, 0)',
                    [businessName]
                );
                businessId = result.insertId;
            } catch (storeErr) {
                console.log('Stores table may not exist, continuing without store_id');
                businessId = null;
            }
        }

        // Create merchant account with must_change_password = 1
        const [merchantResult] = await db.execute(
            `INSERT INTO merchants (email, password_hash, name, ${businessType === 'restaurant' ? 'restaurant_id' : 'store_id'}, status, must_change_password) 
             VALUES (?, ?, ?, ?, 'active', 1)`,
            [email, passwordHash, businessName, businessId]
        );

        const merchantId = merchantResult.insertId;

        console.log(`[Admin] Created merchant #${merchantId}: ${businessName} (${businessType}, email: ${email})`);

        sendSuccess(res, {
            merchantId,
            email,
            businessName,
            businessType,
            businessId,
            mustChangePassword: true
        }, 'Merchant account created successfully');

    } catch (err) {
        console.error('Create merchant error:', err);
        sendError(res, 500, 'Failed to create merchant account: ' + err.message);
    }
};

export const createRider = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, adminKey } = req.body;

        // Verify admin key
        const ADMIN_KEY = env.WALLET_SYSTEM_KEY;
        if (adminKey !== ADMIN_KEY) {
            return sendError(res, 401, 'Invalid admin key');
        }

        // Validate required fields
        if (!firstName || !lastName || !email || !phone || !password) {
            return sendError(res, 400, 'Missing required fields: firstName, lastName, email, phone, password');
        }

        // Check if email already exists in users or riders
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return sendError(res, 409, 'A user with this email already exists');
        }

        const [existingRiders] = await db.execute('SELECT id FROM riders WHERE email = ?', [email]);
        if (existingRiders.length > 0) {
            return sendError(res, 409, 'A rider with this email already exists');
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user entry first
        const fullName = `${firstName} ${lastName}`;
        const [userResult] = await db.execute(
            'INSERT INTO users (username, email, phone_number, password_hash, user_type) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, phone, passwordHash, 'rider']
        );
        const userId = userResult.insertId;

        // Create rider entry with must_change_password = 1
        const [riderResult] = await db.execute(
            `INSERT INTO riders (user_id, name, first_name, last_name, email, phone, vehicle_type, plate_number, status, must_change_password) 
             VALUES (?, ?, ?, ?, ?, ?, 'motorcycle', 'PENDING', 'approved', 1)`,
            [userId, fullName, firstName, lastName, email, phone]
        );

        const riderId = riderResult.insertId;

        console.log(`[Admin] Created rider #${riderId}: ${fullName} (email: ${email}, user_id: ${userId})`);

        sendSuccess(res, {
            riderId,
            userId,
            email,
            name: fullName,
            mustChangePassword: true
        }, 'Rider account created successfully');

    } catch (err) {
        console.error('Create rider error:', err);
        sendError(res, 500, 'Failed to create rider account: ' + err.message);
    }
};
