import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up two levels from src/config to get to root
const rootDir = path.join(__dirname, '../../');
const uploadsDir = path.join(rootDir, 'uploads', 'menu');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = randomUUID();
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

export default upload;
