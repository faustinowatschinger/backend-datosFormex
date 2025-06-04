require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authRoutes = require('./auth/router-auth');
const formexRoutes = require('./db-server/router-formex');
const { connectDB: connectUsersDB } = require('./auth/db-users');
const connectFormexDB = require('./db-server/db-formex');

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

// Manejador de errores mejorado
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Error interno del servidor',
        status: err.status || 500
    });
});

let server = null;

// Función para iniciar el servidor
async function startServer() {
    if (server) {
        console.log('El servidor ya está corriendo');
        return;
    }    try {
        // Conectar a ambas bases de datos
        await Promise.all([
            connectUsersDB(),
            connectFormexDB()
        ]);

        // Una vez conectadas las bases de datos, iniciar el servidor
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor API corriendo en http://0.0.0.0:${PORT}`);
        });

        server.timeout = 60000; // Aumentar el timeout a 60 segundos
    } catch (error) {
        console.error('Error fatal al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Manejar el cierre gracioso del servidor
process.on('SIGINT', async () => {
    try {
        if (server) {
            server.close();
            console.log('Servidor HTTP cerrado');
        }
        await mongoose.disconnect();
        console.log('Conexiones MongoDB cerradas');
        process.exit(0);
    } catch (err) {
        console.error('Error al cerrar conexiones:', err);
        process.exit(1);
    }
});

// Iniciar el servidor
startServer();
