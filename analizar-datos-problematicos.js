require('dotenv').config();
const { connectFormexDB, getFormexConnection } = require('./db-server/db-formex');

async function analizarDatosProblematicos() {
    try {
        console.log('🔍 Analizando datos problemáticos...');
        
        await connectFormexDB();
        const db = getFormexConnection();
        
        // Buscar datos de las fechas problemáticas
        const fechasProblematicas = [
            new Date('2025-09-28T00:00:00Z'),
            new Date('2025-09-29T00:00:00Z'),
            new Date('2025-09-30T00:00:00Z')
        ];
        
        for (const fecha of fechasProblematicas) {
            const fechaInicio = new Date(fecha);
            const fechaFin = new Date(fecha);
            fechaFin.setDate(fechaFin.getDate() + 1);
            
            console.log(`\n📅 Analizando datos del ${fecha.toDateString()}:`);
            
            const datos = await db.collection('mediciones').find({
                ts: { $gte: fechaInicio, $lt: fechaFin }
            }).sort({ ts: 1 }).toArray();
            
            console.log(`   Total de registros: ${datos.length}`);
            
            if (datos.length > 0) {
                // Agrupar por cámara
                const porCamara = {};
                const valoresCero = [];
                const valoresValidos = [];
                
                datos.forEach(doc => {
                    if (!porCamara[doc.camaraId]) {
                        porCamara[doc.camaraId] = [];
                    }
                    porCamara[doc.camaraId].push(doc);
                    
                    if (doc.temperatura === 0 || doc.temperatura === '0') {
                        valoresCero.push(doc);
                    } else {
                        valoresValidos.push(doc);
                    }
                });
                
                console.log(`   Cámaras con datos: ${Object.keys(porCamara).join(', ')}`);
                console.log(`   Valores en 0: ${valoresCero.length}`);
                console.log(`   Valores válidos: ${valoresValidos.length}`);
                
                // Mostrar rango de horas
                const primeraHora = new Date(datos[0].ts).getHours();
                const ultimaHora = new Date(datos[datos.length - 1].ts).getHours();
                console.log(`   Rango de horas: ${primeraHora}:00 - ${ultimaHora}:00`);
                
                // Mostrar muestra de datos problemáticos
                if (valoresCero.length > 0) {
                    console.log('   🚨 Muestra de valores en 0:');
                    valoresCero.slice(0, 3).forEach(doc => {
                        console.log(`     - Cámara ${doc.camaraId}, ${new Date(doc.ts).toLocaleString()}, Temp: ${doc.temperatura}`);
                    });
                }
            }
        }
        
        // Buscar todos los registros con temperatura 0
        console.log('\n🚨 Buscando TODOS los registros con temperatura 0:');
        const todosLosCeros = await db.collection('mediciones').find({
            $or: [
                { temperatura: 0 },
                { temperatura: '0' }
            ]
        }).sort({ ts: -1 }).limit(10).toArray();
        
        console.log(`   Total encontrados: ${todosLosCeros.length}`);
        todosLosCeros.forEach(doc => {
            console.log(`   - Cámara ${doc.camaraId}, ${new Date(doc.ts).toLocaleString()}, Temp: ${doc.temperatura}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

analizarDatosProblematicos();