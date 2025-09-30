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
        
        // Obtener el frigorificoId por defecto (desde env o el primero disponible)
        let frigorificoId;
        if (process.env.FRIGORIFICO_ID) {
            const { ObjectId } = require('mongodb');
            frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
        } else {
            // Buscar el primer frigorífico disponible
            const frigorifico = await db.collection('frigorificos').findOne({});
            if (!frigorifico) {
                return res.status(404).json({ error: 'No hay frigoríficos configurados' });
            }
            frigorificoId = frigorifico._id;
        }

        // Lista predefinida de cámaras (17, 18, 19, 20)
        const camarasEsperadas = ['17', '18', '19', '20'];
        
        // Obtener datos existentes por cámara
        const datosExistentes = await db.collection('mediciones').aggregate([
            // Filtrar por frigorífico
            { $match: { frigorificoId: frigorificoId } },
            // Ordenar ascendente por timestamp para que $last sea realmente la última
            { $sort: { ts: 1 } },
            // Agrupar por cámara y obtener la última medición consistente
            {
                $group: {
                    _id: '$camaraId',
                    lastMeasurement: { $last: '$$ROOT' },
                    totalMeasurements: { $sum: 1 }
                }
            }
        ]).toArray();
        
        // Crear mapa de datos existentes
        const datosMap = {};
        datosExistentes.forEach(item => {
            datosMap[item._id] = item;
        });
        
        // Generar datos para todas las cámaras (con o sin datos)
        const camarasData = camarasEsperadas.map(camaraId => {
            const datos = datosMap[camaraId];
            
            if (datos) {
                // Cámara con datos reales
                const meta = datos.lastMeasurement.metadata || {};
                const ta1 = (datos.lastMeasurement.temp != null ? datos.lastMeasurement.temp : meta.TA1);
                return {
                    id: camaraId,
                    name: `Cámara ${camaraId}`,
                    lastData: {
                        timestamp: datos.lastMeasurement.ts,
                        data: {
                            ...meta,
                            TA1: ta1 != null ? ta1 : 0
                        }
                    }
                };
            } else {
                // Cámara sin datos - mostrar valores por defecto
                return {
                    id: camaraId,
                    name: `Cámara ${camaraId}`,
                    lastData: {
                        timestamp: new Date(),
                        data: {
                            TA1: 0,
                            PF: 0,
                            Hum: 0
                        }
                    }
                };
            }
        });

        if (camarasData.length === 0) {
            console.log('⚠️ No se encontraron mediciones en la colección mediciones');
        }

        res.json(camarasData);
    } catch (error) {
        console.error('Error fetching mediciones:', error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
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
        const camarasValidas = ['17', '18', '19', '20'];
        if (!camarasValidas.includes(camaraId)) {
            return res.status(404).json({ msg: 'Cámara no válida' });
        }
        
        // Verificar si existen mediciones para esta cámara
        const exists = await db.collection('mediciones').findOne({
            frigorificoId: frigorificoId,
            camaraId: camaraId
        });
        
        if (!exists) {
            // Para cámaras sin datos, devolver array vacío
            return res.json([]);
        }

        // Agrupar por día calendario LOCAL (sin desplazar artificialmente registros a otro día)
        // Se utiliza la zona horaria específica para evitar que horas >21 se desplacen al "día siguiente" en UTC.
        const results = await db.collection('mediciones').aggregate([
            { $match: { frigorificoId: frigorificoId, camaraId: camaraId } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$ts', timezone: TIMEZONE }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]).toArray();
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
        const camarasValidas = ['17', '18', '19', '20'];
        if (!camarasValidas.includes(camaraId)) {
            return res.status(404).json({ msg: 'Cámara no válida' });
        }
        
        // Verificar si existe la cámara en datos
        const exists = await db.collection('mediciones').findOne({
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

        // Si se especifica fecha, filtrar el día calendario local completo (00:00 a 23:59:59.999) en la TZ definida
        // Necesitamos incluir la hora 00:00 LOCAL de ese mismo día como primera hora (no en el día siguiente).
        // Estrategia: calcular inicio y fin utilizando desplazamiento fijo -03:00 (Argentina sin DST) y mapear a UTC.
        if (date) {
            const [yy, mm, dd] = date.split('-').map(Number);
            // Inicio del día local (00:00 -03) => UTC = 03:00 del mismo día
            const startUtc = new Date(Date.UTC(yy, mm - 1, dd, 3, 0, 0, 0));
            // Fin exclusivo: inicio del siguiente día local
            const endUtcExclusive = new Date(Date.UTC(yy, mm - 1, dd + 1, 3, 0, 0, 0));
            filter.ts = { $gte: startUtc, $lt: endUtcExclusive };
            console.log(`📅 Día local ${date} (incluye 00..23) => rango UTC ${startUtc.toISOString()} - ${endUtcExclusive.toISOString()} (excl)`);
        }

        // Consultar mediciones
        const rawDocs = await db.collection('mediciones')
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
        const variables = Array.from(variableSet).sort();

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