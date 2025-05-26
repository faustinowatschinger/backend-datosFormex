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
        }        let docs;
        if (date) {
            // Parse the date components
            const [year, month, day] = date.split('-').map(Number);
              // Create timestamps for the complete day range
            // Add previous day 21:00 to next day 20:59 to ensure we get all data
            const startTime = new Date(year, month - 1, day - 1, 21, 0, 0);
            const endTime = new Date(year, month - 1, day + 1, 20, 59, 59);

            docs = await db.collection(colName).aggregate([
                {
                    $match: {
                        timestamp: {
                            $gte: startTime,
                            $lte: endTime
                        }
                    }
                },
                // Ordenar por timestamp para asegurar continuidad
                { $sort: { timestamp: 1 } }
            ]).toArray();            // Log cantidad de registros encontrados y rango horario
            const hours = docs.map(d => new Date(d.timestamp).getHours());
            console.log(`📊 Encontrados ${docs.length} registros para ${colName} en ${date}`);
            if (docs.length > 0) {
                console.log(`   🕒 Rango horario: ${Math.min(...hours)}:00 - ${Math.max(...hours)}:59`);
            }
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