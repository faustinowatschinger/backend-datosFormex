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
// router-formex.js
router.get('/camera/:cam/dates', async (req, res) => {
  const db      = await connectMongo();
  const colName = `FormexCam${req.params.cam}`;
  const exists  = await db.listCollections({ name: colName }).hasNext();
  if (!exists) return res.status(404).json({ msg: 'Cámara no existe' });

  const results = await db
    .collection(colName)
    .aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format:   "%Y-%m-%d",
              date:     "$timestamp",
              timezone: "America/Argentina/Salta"
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ])
    .toArray();

  res.json(results.map(r => r._id));
});
router.get('/camera/:cam', async (req, res) => {
  try {
    const db = await connectMongo();
    const cam = req.params.cam;
    const date = req.query.date;  // "YYYY-MM-DD"
    const col = `FormexCam${cam}`;

    // ¿Existe la colección?
    const exists = await db.listCollections({ name: col }).hasNext();
    if (!exists) return res.status(404).json({ msg: 'Cámara no existe' });

    let docs;
    if (date) {
      // Crear fechas inicio y fin del día en zona horaria local
      const startDate = new Date(`${date}T00:00:00-03:00`);
      const endDate = new Date(`${date}T23:59:59.999-03:00`);

      console.log('Buscando datos entre:', startDate, 'y', endDate);

      docs = await db.collection(col).aggregate([
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        { $sort: { timestamp: 1 } }
      ]).toArray();
    } else {
      docs = await db.collection(col)
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
    }

    // Validar y limpiar datos
    const cleanDocs = docs.map(doc => {
      const localDate = new Date(doc.timestamp);
      return {
        ...doc,
        localHour: localDate.getHours(),
        data: {
          TA1: parseFloat(doc.data.TA1) || 0,
          PF: parseFloat(doc.data.PF) || 0,
          Hum: parseFloat(doc.data.Hum) || 0
        }
      };
    });

    // Debug logs
    console.log(`Enviando ${cleanDocs.length} registros para cámara ${cam}`);
    console.log('Rango de horas:', 
      Math.min(...cleanDocs.map(d => d.localHour)),
      'a',
      Math.max(...cleanDocs.map(d => d.localHour))
    );

    res.json({ docs: cleanDocs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error interno' });
  }
});

module.exports = router;