const express = require('express');
const router = express.Router();
const { getFormexConnection } = require('./db-formex');
const { resolveFrigorifico } = require('../middleware/frigorifico-resolver');
const medicionSchema = require('./medicion-schema');

// Función helper para obtener la base de datos Formex
const getFormexDb = () => {
    const conn = getFormexConnection();
    if (!conn || conn.readyState !== 1) {
        throw new Error('No hay conexión activa a MongoDB');
    }
    return conn.useDb('formex');
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
 * POST /mediciones
 * Inserta una nueva medición en la colección unificada
 * Requiere X-API-Key header para identificar el frigorífico
 */
router.post('/mediciones', resolveFrigorifico, async (req, res) => {
    try {
        const db = getFormexDb();
        
        // Validar payload
        const validationErrors = validateMedicionPayload(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                error: 'validation_error',
                message: 'Invalid payload',
                details: validationErrors
            });
        }

        // Preparar documento de medición
        const medicion = {
            frigorificoId: req.frigorificoId,
            camaraId: req.body.camaraId.trim(),
            ts: req.body.ts ? new Date(req.body.ts) : new Date(),
            temp: req.body.temp
        };

        // Crear modelo con schema para validación
        const Medicion = db.model('Medicion', medicionSchema);
        const nuevaMedicion = new Medicion(medicion);

        // Insertar en la base de datos
        await nuevaMedicion.save();

        res.status(201).json({
            message: 'Medición insertada correctamente',
            data: {
                id: nuevaMedicion._id,
                frigorificoId: nuevaMedicion.frigorificoId,
                camaraId: nuevaMedicion.camaraId,
                ts: nuevaMedicion.ts,
                temp: nuevaMedicion.temp
            }
        });

    } catch (error) {
        console.error('Error inserting medicion:', error);

        // Manejar error de duplicado (índice único)
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'duplicate_ts',
                message: 'A measurement already exists for this camera at this timestamp'
            });
        }

        // Manejar errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                error: 'validation_error',
                message: 'Validation failed',
                details: validationErrors
            });
        }

        res.status(500).json({
            error: 'internal_error',
            message: 'Error inserting measurement'
        });
    }
});

/**
 * GET /mediciones
 * Obtiene mediciones filtradas por frigorificoId
 * Parámetros opcionales: camaraId, from, to
 */
router.get('/mediciones', resolveFrigorifico, async (req, res) => {
    try {
        const db = getFormexDb();
        
        // Construir filtros
        const filter = {
            frigorificoId: req.frigorificoId
        };

        // Filtro opcional por cámara
        if (req.query.camaraId) {
            filter.camaraId = req.query.camaraId;
        }

        // Filtros opcionales de fecha
        if (req.query.from || req.query.to) {
            filter.ts = {};
            if (req.query.from) {
                filter.ts.$gte = new Date(req.query.from);
            }
            if (req.query.to) {
                filter.ts.$lte = new Date(req.query.to);
            }
        }

        // Parámetros de paginación
        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;

        // Consultar mediciones
        const mediciones = await db.collection('mediciones')
            .find(filter)
            .sort({ ts: -1 })
            .limit(limit)
            .skip(skip)
            .toArray();

        // Contar total para paginación
        const total = await db.collection('mediciones').countDocuments(filter);

        res.json({
            data: mediciones,
            pagination: {
                total,
                limit,
                skip,
                hasMore: skip + mediciones.length < total
            },
            filter: {
                frigorificoId: req.frigorificoId,
                camaraId: req.query.camaraId || null,
                from: req.query.from || null,
                to: req.query.to || null
            }
        });

    } catch (error) {
        console.error('Error fetching mediciones:', error);
        res.status(500).json({
            error: 'internal_error',
            message: 'Error fetching measurements'
        });
    }
});

module.exports = router;