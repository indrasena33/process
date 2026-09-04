require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const cors = require('cors');
const { Readable } = require('stream');

const app = express();

// Enable CORS and handle OPTIONS preflight
app.use(cors());
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets safely from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Validate environment variables on startup
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('CRITICAL: Cloudinary environment variables are missing!');
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

let latestImageUrl = '';

// HTML View Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// API Routes
app.get('/api/latest-image', (req, res) => {
    res.json({ url: latestImageUrl });
});

// Accept POST upload requests on both /api/upload and /upload to prevent route mismatches
app.post(['/api/upload', '/upload'], (req, res) => {
    upload.single('image')(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: err.message || 'File upload error' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'pixel-animations', resource_type: 'auto' },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary API error:', error);
                    return res.status(500).json({ error: error.message || 'Cloudinary upload failed' });
                }
                latestImageUrl = result.secure_url;
                console.log('Successfully uploaded image:', latestImageUrl);
                return res.json({ success: true, url: latestImageUrl });
            }
        );

        // Pipe memory buffer securely to Cloudinary using Node Readable stream
        Readable.from(req.file.buffer).pipe(uploadStream);
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});