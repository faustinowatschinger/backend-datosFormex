require('dotenv').config();
const connectMongo = require('../scada-watcher/mongoClient');

async function testCompresorAPI() {
  try {
    console.log('🧪 Probando API de compresores...');
    
    const db = await connectMongo();
    
    // Test 1: Obtener fechas disponibles para Cmp1
    console.log('\n📅 Test 1: Fechas disponibles para Compresor 1');
    const collection = db.collection('RegistroCmp1');
    const fechasResult = await collection.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('📊 Fechas disponibles:');
    fechasResult.forEach(f => console.log('  -', f._id + ':', f.count, 'registros'));
    
    // Test 2: Obtener datos de una fecha específica
    if (fechasResult.length > 0) {
      const fecha = fechasResult[0]._id;
      console.log('\n📊 Test 2: Datos del compresor 1 para', fecha);
      
      const startDate = new Date(fecha + 'T00:00:00.000Z');
      const endDate = new Date(fecha + 'T23:59:59.999Z');
      
      const datos = await collection.find({
        timestamp: { $gte: startDate, $lte: endDate }
      })
      .sort({ timestamp: 1 })
      .limit(5)
      .toArray();
      
      console.log('📊', datos.length, 'registros encontrados (primeros 5):');
      datos.forEach(d => {
        console.log('  📅', d.timestamp.toISOString());
        console.log('  📊 PS:', d.data.PS, 'PD:', d.data.PD, 'TS:', d.data.TS);
      });
    }
    
    // Test 3: Verificar todos los compresores
    console.log('\n🔧 Test 3: Resumen de todos los compresores');
    for (let i = 1; i <= 6; i++) {
      const collName = 'RegistroCmp' + i;
      const count = await db.collection(collName).countDocuments();
      console.log('  - Compresor', i + ':', count, 'registros');
    }
    
    await db.client.close();
    console.log('\n✅ Tests completados exitosamente');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

testCompresorAPI();