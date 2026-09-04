require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Validate environment variables on startup
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('CRITICAL: Cloudinary environment variables are missing from your .env file!');
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'upload.html'));
});

app.get('/api/latest-image', (req, res) => {
    res.json({ url: latestImageUrl });
});

app.post('/api/upload', (req, res, next) => {
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

        uploadStream.end(req.file.buffer);
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Global Error Handler: Prevents Express from sending HTML error pages
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});