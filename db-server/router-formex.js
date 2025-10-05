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

router.get('/', async (req, res) => {
    try {        
        console.log('🔍 ROUTER FORMEX: Procesando solicitud /data');
        const db = getFormexDb();
        
        // NUEVA LÓGICA: Obtener datos directamente de medicions (donde están todos los datos)
        console.log('📊 ROUTER FORMEX: Obteniendo datos de medicions...');
        
        // Obtener frigorífico
        let frigorificoId;
        if (process.env.FRIGORIFICO_ID) {
            const { ObjectId } = require('mongodb');
            frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
        } else {
            const frigorifico = await db.collection('frigorificos').findOne({});
            frigorificoId = frigorifico ? frigorifico._id : null;
        }
        
        if (!frigorificoId) {
            console.log('❌ ROUTER FORMEX: No hay frigorífico configurado');
            return res.status(404).json({ error: 'No hay frigoríficos configurados' });
        }
        
        // Obtener últimas mediciones por cámara/compresor
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
        
        console.log('📊 ROUTER FORMEX: Agregaciones encontradas:', agregadas.length);
        
        // Crear lista base con todos los IDs posibles
        const baseIds = Array.from({length:20}, (_,i)=> String(i+1));
        baseIds.push('SalaMaq');
        baseIds.push('Cmp1', 'Cmp2', 'Cmp3', 'Cmp4', 'Cmp5', 'Cmp6');
        
        const map = Object.fromEntries(agregadas.map(a => [a._id, a]));
        const camarasData = [];
        
        // Procesar cada ID
        baseIds.forEach(id => {
            const dato = map[id];
            
            if (dato) {
                const meta = dato.lastMeasurement.metadata || {};
                const ta1 = (dato.lastMeasurement.temp != null ? dato.lastMeasurement.temp : meta.TA1);
                
                // Determinar tipo y nombre
                let friendly, type;
                if (id === 'SalaMaq') {
                    friendly = 'Sala de Máquinas';
                    type = 'camara';
                } else if (id.startsWith('Cmp')) {
                    friendly = `Compresor ${id.replace('Cmp', '')}`;
                    type = 'compresor';
                } else {
                    friendly = `Cámara ${id}`;
                    type = 'camara';
                }
                
                console.log('✅ ROUTER FORMEX: Procesando', friendly, '(' + type + ')');
                camarasData.push({
                    id,
                    name: friendly,
                    type: type,
                    lastData: {
                        timestamp: dato.lastMeasurement.ts,
                        data: { ...meta, TA1: ta1 != null ? ta1 : 0 }
                    }
                });
            } else {
                // Sin datos - crear entrada por defecto
                const name = id === 'SalaMaq' ? 'Sala de Máquinas' : id.startsWith('Cmp') ? `Compresor ${id.replace('Cmp', '')}` : `Cámara ${id}`;
                const type = id === 'SalaMaq' || !id.startsWith('Cmp') ? 'camara' : 'compresor';
                
                camarasData.push({
                    id,
                    name,
                    type,
                    lastData: {
                        timestamp: new Date(),
                        data: id.startsWith('Cmp') ? { PS: 0, PD: 0, TS: 0 } : { TA1: 0, PF: 0, Hum: 0 }
                    }
                });
            }
        });
        
        const cameras = camarasData.filter(item => item.type === 'camara');
        const compresors = camarasData.filter(item => item.type === 'compresor');
        
        console.log('📊 ROUTER FORMEX: Resultado - Cámaras:', cameras.length, ', Compresores:', compresors.length);

        if (camarasData.length === 0) {
            console.log('⚠️ No se encontraron colecciones de cámaras');
        }

        res.json(camarasData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

router.get('/camera/:cam/dates', async (req, res) => {    try {
        const colName = `FormexCam${req.params.cam}`;
        const db = getFormexDb();
        
        const collections = await db.db.listCollections({ name: colName }).toArray();
        if (collections.length === 0) {
            return res.status(404).json({ msg: 'Cámara no existe' });
        }        const results = await db.collection(colName).aggregate([
            {
                $project: {
                    dateStr: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$timestamp",
                            timezone: "America/Argentina/Salta"
                        }
                    },
                    hour: { $hour: "$timestamp" }
                }
            },
            {
                $group: {
                    _id: "$dateStr",
                    hoursCount: { $addToSet: "$hour" },
                    totalCount: { $sum: 1 }
                }
            },
            {
                $match: {
                    $and: [
                        { totalCount: { $gt: 1 } },  // más de un registro
                        { "hoursCount.0": { $exists: true } },  // al menos una hora
                        { $expr: { $gt: [{ $size: "$hoursCount" }, 1] } }  // más de una hora diferente
                    ]
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();

        res.json(results.map(r => r._id));
    } catch (error) {
        console.error('Error getting dates:', error);
        res.status(500).json({ msg: error.message || 'Error interno del servidor' });
    }
});

router.get('/camera/:cam', async (req, res) => {    try {
        const cam = req.params.cam;
        const date = req.query.date;
        const colName = `FormexCam${cam}`;
        const db = getFormexDb();

        const collections = await db.db.listCollections({ name: colName }).toArray();
        if (collections.length === 0) {
            return res.status(404).json({ msg: 'Cámara no existe' });
        }

        let docs;
        if (date) {            docs = await db.collection(colName).aggregate([
                {
                    $match: {
                        $expr: {
                            $eq: [
                                {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$timestamp',
                                        timezone: 'America/Argentina/Salta'
                                    }
                                },
                                date
                            ]
                        }
                    }
                },
                { $sort: { timestamp: 1 } }
            ]).toArray();
        } else {
            docs = await db.collection(colName)
                .find({})
                .sort({ timestamp: 1 })
                .toArray();
        }

        res.json({ docs });
    } catch (error) {
        console.error('Error getting camera data:', error);
        res.status(500).json({ msg: error.message || 'Error interno del servidor' });
    }
});

// Endpoints para compresores
router.get('/compresores/:id/fechas', async (req, res) => {
    try {
        const db = getFormexDb();
        const compresorId = req.params.id;
        const collectionName = `RegistroCmp${compresorId}`;
        
        const fechas = await db.collection(collectionName)
            .aggregate([
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$timestamp"
                            }
                        }
                    }
                },
                { $sort: { "_id": 1 } }
            ]).toArray();
            
        res.json(fechas.map(f => f._id));
    } catch (error) {
        console.error('Error fetching compresor dates:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/compresores/:id/datos/:fecha', async (req, res) => {
    try {
        const db = getFormexDb();
        const compresorId = req.params.id;
        const fecha = req.params.fecha; // YYYY-MM-DD
        const collectionName = `RegistroCmp${compresorId}`;
        
        const startDate = new Date(fecha + 'T00:00:00.000Z');
        const endDate = new Date(fecha + 'T23:59:59.999Z');
        
        const docs = await db.collection(collectionName)
            .find({
                timestamp: {
                    $gte: startDate,
                    $lte: endDate
                }
            })
            .sort({ timestamp: 1 })
            .toArray();
        
        // Extraer variables de los datos
        const variables = [];
        if (docs.length > 0 && docs[0].data) {
            variables.push(...Object.keys(docs[0].data));
        }
        
        res.json({ docs, variables });
    } catch (error) {
        console.error('Error fetching compresor data:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;