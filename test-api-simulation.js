require('dotenv').config();
const { getFormexConnection } = require('./db-server/db-formex');

async function simulateAPI() {
  try {
    console.log('🔍 SIMULANDO API /data/mediciones');
    console.log('='.repeat(50));
    
    // Simular exactamente el código del router
    const conn = getFormexConnection();
    if (!conn || conn.readyState !== 1) {
      console.log('❌ No hay conexión MongoDB');
      return;
    }
    const db = conn.useDb('formex');
    
    // Obtener frigorífico
    let frigorificoId;
    if (process.env.FRIGORIFICO_ID) {
      const { ObjectId } = require('mongodb');
      frigorificoId = new ObjectId(process.env.FRIGORIFICO_ID);
      console.log('📊 Usando FRIGORIFICO_ID del .env:', frigorificoId);
    } else {
      const frigorifico = await db.collection('frigorificos').findOne({});
      if (!frigorifico) {
        console.log('❌ No hay frigoríficos configurados');
        return;
      }
      frigorificoId = frigorifico._id;
      console.log('📊 Usando primer frigorífico:', frigorificoId);
    }
    
    // Obtener últimas mediciones por cámara
    console.log('\n🔍 AGREGANDO MEDICIONES...');
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
    
    console.log('📊 Agregaciones encontradas:', agregadas.length);
    agregadas.forEach(a => {
      console.log('   -', a._id + ':', a.totalMeasurements, 'mediciones');
    });
    
    // Crear baseIds (exactamente como el router)
    const baseIds = Array.from({length:20}, (_,i)=> String(i+1));
    baseIds.push('17','18','19','20','SalaMaq');
    baseIds.push('Cmp1', 'Cmp2', 'Cmp3', 'Cmp4', 'Cmp5', 'Cmp6');
    const uniqueBase = [...new Set(baseIds)];
    console.log('\n📊 BaseIds configurados:', uniqueBase);
    
    const map = Object.fromEntries(agregadas.map(a => [a._id, a]));
    
    console.log('\n🔍 CREANDO RESPUESTA API...');
    const camarasData = uniqueBase.map(id => {
      const dato = map[id];
      console.log('   🔍 Procesando ID:', id, '- Tiene datos:', !!dato);
      
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
        
        console.log('      ✅ Con datos -', friendly, '(' + type + ')');
        return {
          id,
          name: friendly,
          type: type,
          lastData: {
            timestamp: dato.lastMeasurement.ts,
            data: { ...meta, TA1: ta1 != null ? ta1 : 0 }
          }
        };
      }
      
      // Sin datos
      const name = id === 'SalaMaq' ? 'Sala de Máquinas' : id.startsWith('Cmp') ? `Compresor ${id.replace('Cmp', '')}` : `Cámara ${id}`;
      const type = id === 'SalaMaq' || !id.startsWith('Cmp') ? 'camara' : 'compresor';
      console.log('      ⚠️ Sin datos -', name, '(' + type + ')');
      return {
        id,
        name,
        type,
        lastData: {
          timestamp: new Date(),
          data: id.startsWith('Cmp') ? { PS: 0, PD: 0, TS: 0 } : { TA1: 0, PF: 0, Hum: 0 }
        }
      };
    });
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log('Total items:', camarasData.length);
    
    const cameras = camarasData.filter(item => item.type === 'camara');
    const compresors = camarasData.filter(item => item.type === 'compresor');
    
    console.log('📷 Cámaras:', cameras.length);
    console.log('🔧 Compresores:', compresors.length);
    
    console.log('\n🔧 COMPRESORES DETALLADOS:');
    compresors.forEach(comp => {
      console.log('   -', comp.name, '(' + comp.id + ')');
      console.log('     📅 Timestamp:', comp.lastData.timestamp);
      console.log('     📊 Data keys:', Object.keys(comp.lastData.data));
    });
    
    await conn.close();
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  }
}

simulateAPI();