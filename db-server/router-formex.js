const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Función helper para obtener la base de datos Formex
const getFormexDb = () => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('No hay conexión activa a MongoDB');
    }
    return mongoose.connection.useDb('Formex');
};

router.get('/', async (req, res) => {
    try {        const db = getFormexDb();
        const collections = await db.db.listCollections().toArray();
        const camarasData = [];

        for (const collection of collections) {
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
                    }
                }
            },
            {
                $group: {
                    _id: "$dateStr",
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    count: { $gt: 0 }
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

module.exports = router;