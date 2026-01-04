import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { generateToken } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            console.log(`[Auth] Login Failed - User not found: ${email}`);
            return sendError(res, 401, 'User not found');
        }
        const user = results[0];

        // DEBUG LOGGING
        console.log(`[Auth] Login Attempt - Email: '${email}'`);
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) {
            console.log(`[Auth] Login Failed - Invalid password for ${email}`);
            return sendError(res, 401, 'Invalid password');
        }

        const token = generateToken({ id: user.id, role: user.user_type });
        sendSuccess(res, { id: user.id, username: user.username, email: user.email, token, accessToken: token });
    } catch (err) {
        sendError(res, 500, "Login failed", "AUTH_ERROR", err);
    }
};

export const sendOtp = (req, res) => {
    sendError(res, 503, "Registration is closed for at the moment");
};

export const register = (req, res) => {
    sendError(res, 503, "Registration is closed for at the moment");
};
