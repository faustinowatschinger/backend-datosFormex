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
            
            // Agrupar por cámara y obtener la última medición
            {
                $group: {
                    _id: '$camaraId',
                    lastMeasurement: { $last: '$$ROOT' },
                    lastTimestamp: { $max: '$ts' },
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
                return {
                    id: camaraId,
                    name: `Cámara ${camaraId}`,
                    lastData: {
                        timestamp: datos.lastTimestamp,
                        data: {
                            TA1: datos.lastMeasurement.temp || 0,
                            PF: datos.lastMeasurement.metadata?.PF || 0,
                            Hum: datos.lastMeasurement.metadata?.Hum || 0
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

        // Agrupar por fecha
        const results = await db.collection('mediciones').aggregate([
            // Filtrar por frigorífico y cámara
            { 
                $match: { 
                    frigorificoId: frigorificoId,
                    camaraId: camaraId
                } 
            },
            
            // Agrupar por día
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$ts" }
                    }
                }
            },
            
            // Ordenar por fecha
            { $sort: { "_id": 1 } }
        ]).toArray();

        // Extraer solo las fechas
        const dates = results.map(r => r._id);
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

        // Si se especifica fecha, filtrar por rango de día
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            filter.ts = { $gte: start, $lt: end };
        }

        // Consultar mediciones
        const rawDocs = await db.collection('mediciones')
            .find(filter)
            .sort({ ts: 1 }) // Ordenar por timestamp ascendente
            .toArray();

        // Transformar al formato esperado por el frontend
        const docs = rawDocs.map(doc => ({
            timestamp: doc.ts,
            data: {
                TA1: doc.temp || 0, // Temperatura principal
                PF: doc.metadata?.PF || 0,
                Hum: doc.metadata?.Hum || 0,
                TA2: doc.metadata?.TA2 || 0,
                Marchas: doc.metadata?.Marchas || 0,
                TAux1: doc.metadata?.TAux1 || 0,
                TAux2: doc.metadata?.TAux2 || 0,
                TAux3: doc.metadata?.TAux3 || 0,
                TAux4: doc.metadata?.TAux4 || 0,
                TGent: doc.metadata?.TGent || 0,
                TGSal: doc.metadata?.TGSal || 0,
                CO2: doc.metadata?.CO2 || 0,
                O2: doc.metadata?.O2 || 0
            }
        }));

        // Obtener última fecha si no se especificó fecha
        const lastDate = !date && docs.length 
            ? docs[docs.length - 1].timestamp.toISOString().slice(0, 10)
            : undefined;

        res.json({ docs, lastDate });
        
    } catch (error) {
        console.error('Error fetching camera data:', error);
        res.status(500).json({ msg: 'Error interno' });
    }
});

module.exports = router;