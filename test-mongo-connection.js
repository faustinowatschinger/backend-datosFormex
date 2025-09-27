require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
    const uri = process.env.MONGODB_URI;
    console.log('🔍 URI de conexión:', uri);
    
    try {
        console.log('🔧 Intentando conectar a MongoDB...');
        const client = new MongoClient(uri);
        await client.connect();
        
        console.log('✅ Conexión exitosa a MongoDB');
        
        const db = client.db('formex');
        const collections = await db.listCollections().toArray();
        
        console.log('📋 Colecciones encontradas:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        await client.close();
        console.log('🔐 Conexión cerrada exitosamente');
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.error('Detalles:', error);
    }
}

testConnection();