const express = require('express');
const router = express.Router();
const connectMongo = require('./mongoClient');

router.get('/', async (req, res) => {
    try {
        const db = await connectMongo();
        const collections = await db.listCollections().toArray();
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

        res.json(camarasData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
router.get('/camera/:cam/dates', async (req, res) => {
  const db      = await connectMongo();
  const colName = `FormexCam${req.params.cam}`;
  const exists  = await db.listCollections({ name: colName }).hasNext();
  if (!exists) return res.status(404).json({ msg: 'Cámara no existe' });

  const results = await db.collection(colName).aggregate([
    // 1. Creamos adjTs = timestamp - 3h (pasa UTC→Salta)
    {
      $addFields: {
        adjTs: { $subtract: [ '$timestamp', 1000 * 60 * 60 * 3 ] }
      }
    },
    // 2. Agrupamos por día local (adjTs) YYYY-MM-DD
    {
      $group: {
        _id: {
          $dateToString: {
            format:   '%Y-%m-%d',
            date:     '$adjTs'
          }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]).toArray();

  res.json(results.map(r => r._id));
});

// 2) Serie del día seleccionado, también usando adjTs para el match
router.get('/camera/:cam', async (req, res) => {
  try {
    const db      = await connectMongo();
    const cam     = req.params.cam;
    const date    = req.query.date;           // e.g. "2025-05-12"
    const colName = `FormexCam${cam}`;
    const exists  = await db.listCollections({ name: colName }).hasNext();
    if (!exists) return res.status(404).json({ msg: 'Cámara no existe' });

    let docs;
    if (date) {
      docs = await db.collection(colName).aggregate([
        // 1. Ajustamos timestamp a hora local
        {
          $addFields: {
            adjTs: { $subtract: [ '$timestamp', 1000 * 60 * 60 * 3 ] }
          }
        },
        // 2. Filtramos sólo los que caen en `date`
        {
          $match: {
            $expr: {
              $eq: [
                {
                  $dateToString: {
                    format:   '%Y-%m-%d',
                    date:     '$adjTs'
                  }
                },
                date
              ]
            }
          }
        },
        // 3. Orden real por timestamp original
        { $sort: { timestamp: 1 } },
        // 4. Ya no necesitamos adjTs
        { $project: { adjTs: 0 } }
      ]).toArray();
    } else {
      docs = await db.collection(colName)
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
    }

    res.json({ docs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error interno' });
  }
});

module.exports = router;