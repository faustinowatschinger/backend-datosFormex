const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Función helper para obtener la colección
const getCollection = async (collectionName) => {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('No hay conexión activa a MongoDB');
    }
    return mongoose.connection.db.collection(collectionName);
};

router.get('/', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const camarasData = [];

        for (const collection of collections) {
            if (collection.name.startsWith('FormexCam')) {
                const data = await getCollection(collection.name)
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

        res.json(camarasData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/camera/:cam/dates', async (req, res) => {
    try {
        const colName = `FormexCam${req.params.cam}`;
        const collection = await getCollection(colName);
        
        if (!collection) {
            return res.status(404).json({ msg: 'Cámara no existe' });
        }

        const results = await collection.aggregate([
            {
                $project: {
                    dateStr: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$timestamp",
                            timezone: "America/Argentina/Salta"
                        }
                    },
                    hour: {
                        $hour: {
                            date: "$timestamp",
                            timezone: "America/Argentina/Salta"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$dateStr",
                    minHour: { $min: "$hour" },
                    maxHour: { $max: "$hour" }
                }
            },
            {
                $match: {
                    $expr: {
                        $not: [
                            { $and: [
                                { $eq: ["$minHour", 0] },
                                { $eq: ["$maxHour", 0] }
                            ]}
                        ]
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();

        res.json(results.map(r => r._id));
    } catch (error) {
        console.error('Error getting dates:', error);
        res.status(500).json({ msg: 'Error interno del servidor' });
    }
});

router.get('/camera/:cam', async (req, res) => {
    try {
        const cam = req.params.cam;
        const date = req.query.date;
        const colName = `FormexCam${cam}`;
        const collection = await getCollection(colName);

        if (!collection) {
            return res.status(404).json({ msg: 'Cámara no existe' });
        }

        let docs;
        if (date) {
            docs = await collection.aggregate([
                {
                    $addFields: {
                        adjTs: { $subtract: ['$timestamp', 1000 * 60 * 60 * 3] }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $eq: [
                                {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$adjTs'
                                    }
                                },
                                date
                            ]
                        }
                    }
                },
                { $sort: { timestamp: 1 } },
                { $project: { adjTs: 0 } }
            ]).toArray();
        } else {
            docs = await collection
                .find({})
                .sort({ timestamp: 1 })
                .toArray();
        }

        res.json({ docs });
    } catch (error) {
        console.error('Error getting camera data:', error);
        res.status(500).json({ msg: 'Error interno del servidor' });
    }
});

module.exports = router;