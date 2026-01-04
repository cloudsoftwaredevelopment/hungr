import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
    if (!token) return sendError(res, 401, 'No token provided', 'AUTH_ERROR');

    jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
        if (err) return sendError(res, 403, 'Invalid token', 'AUTH_ERROR');
        req.user = decoded;
        next();
    });
};

export const generateToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY });
};
