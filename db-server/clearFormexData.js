require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

async function clearFormexData() {
    const client = new MongoClient(process.env.MONGODB_URI, {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000
    });

    try {
        await client.connect();
        console.log('Conectado a MongoDB');

        const db = client.db('Formex');
        
        // Listar todas las colecciones
        const collections = await db.listCollections().toArray();
        const formexCollections = collections.filter(col => col.name.startsWith('FormexCam'));

        if (formexCollections.length === 0) {
            console.log('No se encontraron colecciones de Formex');
            return;
        }

        // Pedir confirmación
        console.log(`⚠️  Se encontraron ${formexCollections.length} colecciones:`);
        formexCollections.forEach(col => console.log(`- ${col.name}`));
        console.log('\n⚠️  ADVERTENCIA: Esta operación eliminará TODOS los datos de estas colecciones');
        console.log('Presiona Ctrl+C para cancelar o espera 5 segundos para continuar...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Eliminar datos de cada colección
        for (const col of formexCollections) {
            const result = await db.collection(col.name).deleteMany({});
            console.log(`✅ Eliminados ${result.deletedCount} documentos de ${col.name}`);
        }

        console.log('\n✅ Proceso completado');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    clearFormexData().catch(console.error);
}

module.exports = { clearFormexData };
