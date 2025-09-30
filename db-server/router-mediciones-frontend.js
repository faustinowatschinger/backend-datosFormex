const express = require('express');
const router = express.Router();
const { getFormexConnection } = require('./db-formex');

// Función helper para obtener la base de datos Formex
const getFormexDb = () => {
    const conn = getFormexConnection();
    if (!conn || conn.readyState !== 1) {
        throw new Error('No hay conexión activa a MongoDB');
    }
    return conn.useDb('formex');
};

/**
 * GET /api/data/mediciones - Nueva versión que lee desde la colección mediciones
 * Devuelve un listado de cámaras con su última medición
 */
router.get('/mediciones', async (req, res) => {
    try {
        const db = getFormexDb();
        // Obtener frigorífico
        let frigorificoId;
        if (process.env.FRIGORIFICO_ID) {
            const { ObjectId } = require('mongodb');
            frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
        } else {
            const frigorifico = await db.collection('frigorificos').findOne({});
            if (!frigorifico) return res.status(404).json({ error: 'No hay frigoríficos configurados' });
            frigorificoId = frigorifico._id;
        }

        // Obtener últimas mediciones por cámara (todas las que existan)
        const agregadas = await db.collection('medicions').aggregate([
            { $match: { frigorificoId } },
            { $sort: { ts: 1 } },
            {
                $group: {
                    _id: '$camaraId',
                    lastMeasurement: { $last: '$$ROOT' },
                    totalMeasurements: { $sum: 1 }
                }
            }
        ]).toArray();

        // Si queremos garantizar que aparezcan cámaras del 1..20 aunque aún no tengan datos:
        const baseIds = Array.from({length:20}, (_,i)=> String(i+1));
        // Añadir especiales
        baseIds.push('17','18','19','20','SalaMaq'); // 17..20 ya incluidos pero no duplica
        const uniqueBase = [...new Set(baseIds)];

        const map = Object.fromEntries(agregadas.map(a => [a._id, a]));

        const camarasData = uniqueBase.map(id => {
            const dato = map[id];
            if (dato) {
                const meta = dato.lastMeasurement.metadata || {};
                const ta1 = (dato.lastMeasurement.temp != null ? dato.lastMeasurement.temp : meta.TA1);
                const friendly = id === 'SalaMaq' ? 'Sala de Máquinas' : `Cámara ${id}`;
                return {
                    id,
                    name: friendly,
                    lastData: {
                        timestamp: dato.lastMeasurement.ts,
                        data: { ...meta, TA1: ta1 != null ? ta1 : 0 }
                    }
                };
            }
            return {
                id,
                name: id === 'SalaMaq' ? 'Sala de Máquinas' : `Cámara ${id}`,
                lastData: {
                    timestamp: new Date(),
                    data: { TA1: 0, PF: 0, Hum: 0 }
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
        
        // Obtener el frigorificoId
        let frigorificoId;
        if (process.env.FRIGORIFICO_ID) {
            const { ObjectId } = require('mongodb');
            frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
        } else {
            const frigorifico = await db.collection('frigorificos').findOne({});
            if (!frigorifico) {
                return res.status(404).json({ msg: 'No hay frigoríficos configurados' });
            }
            frigorificoId = frigorifico._id;
        }

        // Verificar si la cámara está en la lista de cámaras válidas
    const camarasValidas = [...Array.from({length:20}, (_,i)=> String(i+1)), 'SalaMaq'];
        if (!camarasValidas.includes(camaraId)) {
            return res.status(404).json({ msg: 'Cámara no válida' });
        }
        
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
        if (camaraId === 'SalaMaq') {
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
        
        // Obtener el frigorificoId
        let frigorificoId;
        if (process.env.FRIGORIFICO_ID) {
            const { ObjectId } = require('mongodb');
            frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
        } else {
            const frigorifico = await db.collection('frigorificos').findOne({});
            if (!frigorifico) {
                return res.status(404).json({ msg: 'No hay frigoríficos configurados' });
            }
            frigorificoId = frigorifico._id;
        }

        // Verificar si la cámara está en la lista de cámaras válidas
    const camarasValidas = [...Array.from({length:20}, (_,i)=> String(i+1)), 'SalaMaq'];
        if (!camarasValidas.includes(camaraId)) {
            return res.status(404).json({ msg: 'Cámara no válida' });
        }
        
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
            if (camaraId === 'SalaMaq') {
                // Día calendario local completo 00..23
                const startUtc = new Date(Date.UTC(yy, mm - 1, dd, 3, 0, 0, 0)); // 00 local
                const endUtcExclusive = new Date(Date.UTC(yy, mm - 1, dd + 1, 3, 0, 0, 0));
                filter.ts = { $gte: startUtc, $lt: endUtcExclusive };
                console.log(`📅 SalaMaq día ${date} => UTC ${startUtc.toISOString()} - ${endUtcExclusive.toISOString()} (excl)`);
            } else {
                // Ciclo cámaras 01..23 + 00
                const startUtc = new Date(Date.UTC(yy, mm - 1, dd, 4, 0, 0, 0)); // 01 local
                const endUtcExclusive = new Date(Date.UTC(yy, mm - 1, dd + 1, 4, 0, 0, 0));
                filter.ts = { $gte: startUtc, $lt: endUtcExclusive };
                console.log(`📅 Ciclo cámaras ${date} (01..23,00) => UTC ${startUtc.toISOString()} - ${endUtcExclusive.toISOString()} (excl)`);
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