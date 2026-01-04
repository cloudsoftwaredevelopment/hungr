import express from 'express';
import { login, sendOtp, register } from '../controllers/authController.js';

const router = express.Router();

// User/Rider Login
router.post('/login', login);

// Registration (Currently Closed)
router.post('/send-otp', sendOtp);
router.post('/register', register);

export default router;
