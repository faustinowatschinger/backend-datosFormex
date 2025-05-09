require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authRoutes = require('./auth/router-auth');
const formexRoutes = require('./db-server/router-formex');

const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de CORS
const corsOptions = {
    origin: '*', // En producción, especifica los orígenes permitidos
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Opciones de conexión MongoDB
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
};

// Conexión MongoDB para usuarios
mongoose.connect(process.env.MONGODB_URI_USERS, mongooseOptions)
    .then(() => console.log('✅ MongoDB Usuarios conectada'))
    .catch(err => console.error('Error conectando a MongoDB Usuarios:', err));

// Headers de seguridad básicos
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/data', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log('Auth header received:', authHeader);

        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        console.log('Token being verified:', token);
        console.log('JWT_SECRET being used:', process.env.JWT_SECRET);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Successfully decoded token:', decoded);
        
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification failed:', {
            name: error.name,
            message: error.message,
            expiredAt: error.expiredAt
        });
        
        return res.status(401).json({ 
            message: 'Invalid token',
            error: error.message 
        });
    }
}, formexRoutes);

const options = {
    key: fs.readFileSync('/path/to/key.pem'),
    cert: fs.readFileSync('/path/to/cert.pem')
};
// Manejador de errores mejorado
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Error interno del servidor',
        status: err.status || 500
    });
});

// Iniciar servidor con manejo de errores
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HTTPS corriendo en https://0.0.0.0:${PORT}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});