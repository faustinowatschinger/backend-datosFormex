const express = require('express');
const router = express.Router();
const { getFormexConnection } = require('./db-formex');
const { ObjectId } = require('mongodb');

// Función helper para obtener la base de datos Formex
const getFormexDb = () => {
    const conn = getFormexConnection();
    if (!conn || conn.readyState !== 1) {
        throw new Error('No hay conexión activa a MongoDB');
    }
    return conn.useDb('formex');
};

const FRIGORIFICO_IDS = {
    formex: '68d832ab99a54fc6573fa28e',
    valletana: '68d848c499a54fc65743d431',
    pin: '691f6ba7513350b9eb441c22'
};

const ROLE_ALLOWED_FRIGOS = {
    'Global Fresh': ['formex', 'valletana', 'pin'],
    Formex: ['formex'],
    Valletana: ['valletana'],
    PIN: ['pin']
};

const getAllowedFrigorificoIds = (role) => {
    if (role === '3W') return null;
    const keys = ROLE_ALLOWED_FRIGOS[role];
    if (!keys) return [];
    return keys.map(key => FRIGORIFICO_IDS[key]).filter(Boolean);
};

const isAllowedFrigorificoId = (frigorificoId, allowedIds) => {
    if (!allowedIds) return true;
    return allowedIds.some(id => String(id) === String(frigorificoId));
};

const resolveFrigorificoId = async (req, db) => {
    const allowedIds = getAllowedFrigorificoIds(req.user?.role);

    if (Array.isArray(allowedIds) && allowedIds.length === 0) {
        return { error: { status: 403, code: 'access_denied', message: 'Rol sin acceso a frigoríficos' } };
    }

    if (req.query.frigorificoId) {
        let requestedId;
        try {
            requestedId = new ObjectId(String(req.query.frigorificoId));
        } catch (e) {
            return {
                error: {
                    status: 400,
                    code: 'invalid_frigorificoId',
                    message: 'frigorificoId debe ser un ObjectId válido'
                }
            };
        }

        if (!isAllowedFrigorificoId(requestedId, allowedIds)) {
            return { error: { status: 403, code: 'access_denied', message: 'Acceso denegado al frigorífico solicitado' } };
        }

        return { frigorificoId: requestedId };
    }

    if (Array.isArray(allowedIds) && allowedIds.length === 1) {
        return { frigorificoId: new ObjectId(allowedIds[0]) };
    }

    if (process.env.FRIGORIFICO_ID) {
        try {
            const envId = new ObjectId(process.env.FRIGORIFICO_ID);
            if (isAllowedFrigorificoId(envId, allowedIds)) {
                return { frigorificoId: envId };
            }
        } catch (e) {
            // Ignorar FRIGORIFICO_ID inválido y seguir con el fallback.
        }
    }

    if (Array.isArray(allowedIds) && allowedIds.length > 1) {
        return { frigorificoId: new ObjectId(allowedIds[0]) };
    }

    const frigorifico = await db.collection('frigorificos').findOne({});
    if (!frigorifico) {
        return { error: { status: 404, code: 'no_frigorificos', message: 'No hay frigoríficos configurados' } };
    }

    return { frigorificoId: frigorifico._id };
};

/**
 * GET /api/data/mediciones - Nueva versión que lee desde la colección mediciones
 * Devuelve un listado de cámaras con su última medición
 */
router.get('/mediciones', async (req, res) => {
    try {
        const db = getFormexDb();
        const resolved = await resolveFrigorificoId(req, db);
        if (resolved.error) {
            return res.status(resolved.error.status).json({
                error: resolved.error.code,
                message: resolved.error.message
            });
        }
        const { frigorificoId } = resolved;

        // Obtener últimas mediciones por cámara (solo las que existan para el frigorífico)
        const agregadas = await db.collection('medicions').aggregate([
            { $match: { frigorificoId } },
            { $sort: { ts: 1 } },
            {
                $group: {
                    _id: '$camaraId',
                    lastMeasurement: { $last: '$$ROOT' },
                    totalMeasurements: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]).toArray();

        const camarasData = agregadas.map(dato => {
            const id = dato._id;
            const meta = dato.lastMeasurement.metadata || {};
            const ta1 = (dato.lastMeasurement.temp != null ? dato.lastMeasurement.temp : meta.TA1);

            // Determinar tipo y nombre en base al id
            let friendly, type;
            if (id === 'SalaMaq') {
                friendly = 'Sala de Máquinas';
                type = 'camara';
            } else if (typeof id === 'string' && id.startsWith('Cmp')) {
                friendly = `Compresor ${id.replace('Cmp', '')}`;
                type = 'compresor';
            } else {
                friendly = `Cámara ${id}`;
                type = 'camara';
            }

            return {
                id,
                name: friendly,
                type: type,
                lastData: {
                    timestamp: dato.lastMeasurement.ts,
                    data: { ...meta, TA1: ta1 != null ? ta1 : 0 }
                }
            };
        });

        res.json(camarasData);
    } catch (e) {
        console.error('Error fetching mediciones:', e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * GET /api/data/mediciones/camera/:cam/dates - Nueva versión que lee desde mediciones
 * Devuelve las fechas disponibles para una cámara específica
 */
router.get('/mediciones/camera/:cam/dates', async (req, res) => {
    try {
        const db = getFormexDb();
        const camaraId = req.params.cam;
        const TIMEZONE = 'America/Argentina/Salta'; // Zona horaria local esperada
        
        const resolved = await resolveFrigorificoId(req, db);
        if (resolved.error) {
            return res.status(resolved.error.status).json({
                error: resolved.error.code,
                message: resolved.error.message
            });
        }
        const { frigorificoId } = resolved;

        // Verificar si existen mediciones para esta cámara
        const exists = await db.collection('medicions').findOne({
            frigorificoId: frigorificoId,
            camaraId: camaraId
        });
        
        if (!exists) {
            // Para cámaras sin datos, devolver array vacío
            return res.json([]);
        }

        let results;
        const isCompresor = camaraId.startsWith('Cmp');
        if (camaraId === 'SalaMaq' || isCompresor) {
            // Sala de Máquinas: agrupar por día calendario local directo y contar documentos
            results = await db.collection('medicions').aggregate([
                { $match: { frigorificoId: frigorificoId, camaraId: camaraId } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts', timezone: TIMEZONE } }, count: { $sum: 1 } } },
                { $sort: { '_id': 1 } }
            ]).toArray();
            // Heurística: si hay más de una fecha y la última sólo tiene 1 registro (medianoche aislada), eliminarla
            if (results.length > 1) {
                const firstDate = results[0]._id;
                results = results.filter(r => r.count > 1 || r._id === firstDate);
            }
        } else {
            // Cámaras: ciclo 01..23 y luego 00 del siguiente día en el mismo ciclo
            results = await db.collection('medicions').aggregate([
                { $match: { frigorificoId: frigorificoId, camaraId: camaraId } },
                { $addFields: {
                    _cycleAnchor: {
                        $cond: {
                            if: { $eq: [{ $hour: { date: '$ts', timezone: TIMEZONE } }, 0] },
                            then: { $dateAdd: { startDate: '$ts', unit: 'day', amount: -1 } },
                            else: '$ts'
                        }
                    }
                }},
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$_cycleAnchor', timezone: TIMEZONE } } } },
                { $sort: { '_id': 1 } }
            ]).toArray();
        }
    const dates = results.map(r => r._id).filter(Boolean);
        res.json(dates);
        
    } catch (error) {
        console.error('Error fetching dates for camera:', error);
        res.status(500).json({ msg: 'Error interno' });
    }
});

/**
 * GET /api/data/mediciones/camera/:cam - Nueva versión que lee desde mediciones
 * Devuelve los datos de una cámara, opcionalmente filtrado por fecha
 */
router.get('/mediciones/camera/:cam', async (req, res) => {
    try {
        const db = getFormexDb();
        const camaraId = req.params.cam;
    const { date } = req.query; // Fecha opcional en formato YYYY-MM-DD
        const TIMEZONE = 'America/Argentina/Salta';
        
        const resolved = await resolveFrigorificoId(req, db);
        if (resolved.error) {
            return res.status(resolved.error.status).json({
                error: resolved.error.code,
                message: resolved.error.message
            });
        }
        const { frigorificoId } = resolved;

        // Verificar si existe la cámara en datos
        const exists = await db.collection('medicions').findOne({
            frigorificoId: frigorificoId,
            camaraId: camaraId
        });
        
        if (!exists) {
            // Para cámaras sin datos, devolver estructura vacía
            return res.json({ docs: [] });
        }

        // Construir filtro
        let filter = {
            frigorificoId: frigorificoId,
            camaraId: camaraId
        };

        if (date) {
            const [yy, mm, dd] = date.split('-').map(Number);
            const isCompresor = camaraId.startsWith('Cmp');
            if (camaraId === 'SalaMaq' || isCompresor) {
                // Día calendario local completo 00..23 Argentina
                // 00:00 Argentina = 03:00 UTC del MISMO día, fin exclusivo 03:00 UTC del día siguiente
                const startUtc = new Date(Date.UTC(yy, mm - 1, dd, 3, 0, 0, 0)); // 00:00 Argentina del día
                const endUtcExclusive = new Date(Date.UTC(yy, mm - 1, dd + 1, 3, 0, 0, 0)); // 00:00 Argentina del día siguiente
                filter.ts = { $gte: startUtc, $lt: endUtcExclusive };
                console.log(`📅 ${camaraId} día ${date} (00..23 Argentina) => UTC ${startUtc.toISOString()} - ${endUtcExclusive.toISOString()} (excl)`);
            } else {
                // Ciclo cámaras: desde 01:00 Argentina del día hasta 00:00 Argentina del día siguiente (exclusivo)
                // 01:00 Argentina = 04:00 UTC del MISMO día, fin exclusivo 04:00 UTC del día siguiente
                const startUtc = new Date(Date.UTC(yy, mm - 1, dd, 4, 0, 0, 0)); // 01:00 Argentina del día
                const endUtcExclusive = new Date(Date.UTC(yy, mm - 1, dd + 1, 4, 0, 0, 0)); // 01:00 Argentina del día siguiente  
                filter.ts = { $gte: startUtc, $lt: endUtcExclusive };
                console.log(`📅 Ciclo cámaras ${date} (01..00 Argentina) => UTC ${startUtc.toISOString()} - ${endUtcExclusive.toISOString()} (excl)`);
            }
        }

        // Consultar mediciones
        const rawDocs = await db.collection('medicions')
            .find(filter)
            .sort({ ts: 1 }) // Ordenar por timestamp ascendente
            .toArray();

        // Transformar al formato esperado por el frontend
        const docs = rawDocs.map(doc => {
            const meta = doc.metadata || {};
            const ta1 = (doc.temp != null ? doc.temp : meta.TA1) || 0;
            return {
                timestamp: doc.ts,
                data: { ...meta, TA1: ta1 }
            };
        });

        // Derivar lista de variables dinámicas (excluye timestamp) para ayudar al frontend
        const variableSet = new Set();
        docs.forEach(d => Object.keys(d.data || {}).forEach(k => variableSet.add(k)));
        let variables = Array.from(variableSet).sort();
        if (!variables.length) {
            // Fallback: intentar inferir desde primera metadata cruda si existiera otro formato
            const first = rawDocs[0]?.metadata || {};
            variables = Object.keys(first);
        }

        // Obtener última fecha si no se especificó fecha
        const lastDate = !date && docs.length 
            ? docs[docs.length - 1].timestamp.toISOString().slice(0, 10)
            : undefined;

    res.json({ docs, lastDate, variables });
        
    } catch (error) {
        console.error('Error fetching camera data:', error);
        res.status(500).json({ msg: 'Error interno' });
    }
});

module.exports = router;
