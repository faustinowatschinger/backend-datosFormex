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
// GET /api/data/camera/:cam — devuelve toda la serie ordenada ascendente
// GET /api/data/camera/:cam?date=YYYY-MM-DD
// GET /api/data/camera/:cam/dates → ["2025-04-28","2025-04-29",…]
router.get('/camera/:cam/dates', async (req, res) => {
  try {
    const db      = await connectMongo();
    const colName = `FormexCam${req.params.cam}`;
    const exists  = await db.listCollections({ name: colName }).hasNext();
    if (!exists) return res.status(404).json({ msg: 'Cámara no existe' });

    const results = await db
      .collection(colName)
      .aggregate([
        // 1) restar 1 hora para que los “00:xx” queden en el día anterior
        { 
          $addFields: { 
            adjTs: { $subtract: [ '$timestamp', 1000 * 60 * 60 ] } 
          } 
        },
        // 2) agrupar por fecha local de adjTs
        {
          $group: {
            _id: {
              $dateToString: {
                format:   "%Y-%m-%d",
                date:     "$adjTs",
                timezone: "America/Argentina/Salta"
              }
            }
          }
        },
        { $sort: { "_id": 1 } }
      ])
      .toArray();

    const dates = results.map(r => r._id);
    res.json(dates);

  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error interno' });
  }
});

// GET /api/data/camera/:cam[?date=YYYY-MM-DD]
// router-formex.js
router.get('/camera/:cam', async (req, res) => {
  const db      = await connectMongo();
  const colName = `FormexCam${req.params.cam}`;
  const { date } = req.query;
  if (date) {
    // match exacto por fecha local en Salta
    const docs = await db.collection(colName).aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$timestamp",
                  timezone: "America/Argentina/Salta"
                }
              },
              date
            ]
          }
        }
      },
      { $sort: { timestamp: 1 } }
    ]).toArray();
    return res.json({ docs });
  }
  // sin fecha, devolvemos todo
  const docs = await db.collection(colName).find().sort({ timestamp: 1 }).toArray();
  res.json({ docs });
});


module.exports = router;