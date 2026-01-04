import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow loading images/resources from other origins/paths if needed
    contentSecurityPolicy: false, // Disable CSP for now to avoid breaking existing styles/scripts
}));

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://nfcrevolution.com'],
    credentials: true
}));

// Rate limiting (Apply to API standard paths)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased limit for dev/testing, tune for prod
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply limiter globally for now, or specific routes later
// app.use(limiter); 

app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());

// Debug Logging
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Static Files - Adjusted for src/ location
// Root is one level up
const rootDir = path.join(__dirname, '..');

// Mount dist to /hungr so assets load correctly
app.use('/hungr', express.static(path.join(rootDir, 'dist')));
// Explicitly serve Merchant App
app.use('/hungrmerchant', express.static(path.join(rootDir, '../hungr-merchant/dist')));

// Also mount to root as a backup
app.use(express.static(path.join(rootDir, 'dist')));

// Uploads
app.use('/uploads', express.static(path.join(rootDir, 'uploads')));
app.use('/hungr/uploads', express.static(path.join(rootDir, 'uploads')));

// Serve admin wallet page
app.get('/hungr/admin-wallet.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'admin-wallet.html'));
});
app.get('/admin-wallet', (req, res) => {
    res.sendFile(path.join(rootDir, 'admin-wallet.html'));
});

export default app;
