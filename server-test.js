require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Usar el router de testing en lugar del real
const medicionesTestRoutes = require('./db-server/router-mediciones-test');

const app = express();
const PORT = process.env.PORT || 4001; // Puerto diferente para testing

// Configuración de CORS
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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

// Rutas de testing
app.use('/api', medicionesTestRoutes);

// Ruta de estado
app.get('/', (req, res) => {
    res.json({
        message: 'API de Mediciones - Modo Testing',
        version: '1.0.0',
        endpoints: [
            'POST /api/mediciones - Insertar medición',
            'GET /api/mediciones - Obtener mediciones'
        ],
        auth: 'X-API-Key: test-api-key-12345'
    });
});

// Manejador de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Error interno del servidor',
        status: err.status || 500
    });
});

// Iniciar servidor de testing
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de Testing corriendo en http://0.0.0.0:${PORT}`);
    console.log('📋 Endpoints disponibles:');
    console.log(`   GET  ${PORT === 4001 ? 'http://localhost:4001' : `http://localhost:${PORT}`}/`);
    console.log(`   POST ${PORT === 4001 ? 'http://localhost:4001' : `http://localhost:${PORT}`}/api/mediciones`);
    console.log(`   GET  ${PORT === 4001 ? 'http://localhost:4001' : `http://localhost:${PORT}`}/api/mediciones`);
    console.log('🔑 API Key para testing: test-api-key-12345');
});

// Manejar el cierre gracioso del servidor
process.on('SIGINT', () => {
    console.log('\n🔒 Cerrando servidor de testing...');
    server.close(() => {
        console.log('✅ Servidor cerrado exitosamente');
        process.exit(0);
    });
});

module.exports = app;