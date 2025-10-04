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
    try {        const db = getFormexDb();
        const collections = await db.db.listCollections().toArray();
        const camarasData = [];

        for (const collection of collections) {
            // Manejar cámaras FormexCam
            if (collection.name.startsWith('FormexCam')) {
                const data = await db.collection(collection.name)
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(1)
                    .toArray();
                
                if (data.length > 0) {
                    camarasData.push({
                        id: collection.name.replace('FormexCam', ''),
                        name: `Cámara ${collection.name.replace('FormexCam', '')}`,
                        type: 'camara',
                        lastData: data[0]
                    });
                }
            }
            
            // Manejar compresores RegistroCmp
            if (collection.name.startsWith('RegistroCmp')) {
                const data = await db.collection(collection.name)
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(1)
                    .toArray();
                
                if (data.length > 0) {
                    const compId = collection.name.replace('RegistroCmp', '');
                    camarasData.push({
                        id: compId,
                        name: `Compresor ${compId}`,
                        type: 'compresor',
                        lastData: data[0]
                    });
                }
            }
        }

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