require('dotenv').config();
const { connectFormexDB, getFormexConnection } = require('./db-server/db-formex');

async function verificarDatos() {
    try {
        console.log('🔍 Verificando datos en la base de datos...');
        
        // Conectar a la base de datos
        await connectFormexDB();
        const db = getFormexConnection();
        
        // Verificar colección mediciones
        console.log('\n📊 Verificando colección "mediciones":');
        const medicionesCount = await db.collection('mediciones').countDocuments();
        console.log(`   Total de documentos: ${medicionesCount}`);
        
        if (medicionesCount > 0) {
            // Obtener una muestra de datos
            const muestra = await db.collection('mediciones').findOne();
            console.log('   Muestra de documento:', JSON.stringify(muestra, null, 2));
            
            // Obtener cámaras distintas
            const camaras = await db.collection('mediciones').distinct('camaraId');
            console.log(`   Cámaras encontradas: ${camaras.join(', ')}`);
            
            // Verificar por cada cámara
            for (const camaraId of camaras) {
                const count = await db.collection('mediciones').countDocuments({ camaraId });
                console.log(`     - Cámara ${camaraId}: ${count} mediciones`);
            }
        }
        
        console.log('\n✅ Verificación completada');
        
    } catch (error) {
        console.error('❌ Error en verificación:', error);
    } finally {
        process.exit(0);
    }
}

verificarDatos();