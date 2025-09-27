const express = require('express');
const router = express.Router();

// Mock del middleware resolveFrigorifico para testing
const mockResolveFrigorifico = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ 
            error: 'missing_api_key',
            message: 'X-API-Key header is required' 
        });
    }

    // Mock frigorífico para testing
    if (apiKey === 'test-api-key-12345') {
        req.frigorificoId = '67890abcdef123456789012'; // Mock ObjectId
        req.frigorifico = {
            _id: '67890abcdef123456789012',
            nombre: 'Frigorífico Test',
            apiKey: apiKey
        };
        next();
    } else {
        res.status(401).json({ 
            error: 'invalid_api_key',
            message: 'Invalid API Key' 
        });
    }
};

// Función para validar payload de medición
const validateMedicionPayload = (payload) => {
    const errors = [];

    if (!payload.camaraId || typeof payload.camaraId !== 'string' || payload.camaraId.trim().length === 0) {
        errors.push('camaraId is required and cannot be empty');
    }

    if (payload.ts !== undefined) {
        const ts = new Date(payload.ts);
        if (isNaN(ts.getTime())) {
            errors.push('ts must be a valid date or timestamp');
        }
    }

    if (payload.temp !== undefined && (typeof payload.temp !== 'number' || isNaN(payload.temp))) {
        errors.push('temp must be a valid number');
    }

    return errors;
};

/**
 * POST /mediciones (versión de testing)
 */
router.post('/mediciones', mockResolveFrigorifico, async (req, res) => {
    try {
        console.log('📝 POST /mediciones - Payload recibido:', req.body);
        console.log('🔑 API Key:', req.headers['x-api-key']);
        console.log('🏢 Frigorífico ID:', req.frigorificoId);
        
        // Validar payload
        const validationErrors = validateMedicionPayload(req.body);
        if (validationErrors.length > 0) {
            console.log('❌ Errores de validación:', validationErrors);
            return res.status(400).json({
                error: 'validation_error',
                message: 'Invalid payload',
                details: validationErrors
            });
        }

        // Preparar documento de medición (simulado)
        const medicion = {
            _id: new Date().getTime().toString(), // Mock ID
            frigorificoId: req.frigorificoId,
            camaraId: req.body.camaraId.trim(),
            ts: req.body.ts ? new Date(req.body.ts) : new Date(),
            temp: req.body.temp
        };

        console.log('✅ Medición simulada:', medicion);

        // Simular inserción exitosa
        res.status(201).json({
            message: 'Medición insertada correctamente (TEST MODE)',
            data: {
                id: medicion._id,
                frigorificoId: medicion.frigorificoId,
                camaraId: medicion.camaraId,
                ts: medicion.ts,
                temp: medicion.temp
            }
        });

    } catch (error) {
        console.error('❌ Error en POST /mediciones:', error);
        res.status(500).json({
            error: 'internal_error',
            message: 'Error inserting measurement (TEST MODE)'
        });
    }
});

/**
 * GET /mediciones (versión de testing)
 */
router.get('/mediciones', mockResolveFrigorifico, async (req, res) => {
    try {
        console.log('📊 GET /mediciones - Query params:', req.query);
        console.log('🔑 API Key:', req.headers['x-api-key']);
        console.log('🏢 Frigorífico ID:', req.frigorificoId);

        // Datos de ejemplo
        const medicionesEjemplo = [
            {
                _id: "example1",
                frigorificoId: req.frigorificoId,
                camaraId: "17",
                ts: new Date('2025-01-15T10:30:00Z'),
                temp: 2.5
            },
            {
                _id: "example2", 
                frigorificoId: req.frigorificoId,
                camaraId: "18",
                ts: new Date('2025-01-15T10:29:00Z'),
                temp: 3.2
            },
            {
                _id: "example3",
                frigorificoId: req.frigorificoId,
                camaraId: "19", 
                ts: new Date('2025-01-15T10:28:00Z'),
                temp: -1.8
            }
        ];

        // Filtrar por camaraId si se especifica
        let medicionesFiltradas = medicionesEjemplo;
        if (req.query.camaraId) {
            medicionesFiltradas = medicionesEjemplo.filter(m => m.camaraId === req.query.camaraId);
        }

        console.log('✅ Enviando mediciones de ejemplo:', medicionesFiltradas.length);

        res.json({
            data: medicionesFiltradas,
            pagination: {
                total: medicionesFiltradas.length,
                limit: parseInt(req.query.limit) || 100,
                skip: parseInt(req.query.skip) || 0,
                hasMore: false
            },
            filter: {
                frigorificoId: req.frigorificoId,
                camaraId: req.query.camaraId || null,
                from: req.query.from || null,
                to: req.query.to || null
            },
            mode: 'TEST_MODE'
        });

    } catch (error) {
        console.error('❌ Error en GET /mediciones:', error);
        res.status(500).json({
            error: 'internal_error',
            message: 'Error fetching measurements (TEST MODE)'
        });
    }
});

module.exports = router;