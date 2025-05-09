require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authRoutes = require('./auth/router-auth');
const formexRoutes = require('./db-server/router-formex');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Conexión MongoDB para usuarios
mongoose.connect(process.env.MONGODB_URI_USERS)
    .then(() => console.log('✅ MongoDB Usuarios conectada'))
    .catch(err => console.error('Error conectando a MongoDB Usuarios:', err));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/data', async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}, formexRoutes);

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor API corriendo en http://0.0.0.0:${PORT}`);
});