const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

async function showFormexData() {
    const formexClient = new MongoClient(process.env.MONGODB_URI, {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000
    });

    const usersClient = new MongoClient(process.env.MONGODB_URI_USERS, {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000
    });

    try {
        await formexClient.connect();
        await usersClient.connect();
        console.log('Conectado a MongoDB');

        // Mostrar usuarios primero
        console.log('\n👥 USUARIOS:');
        const usersDb = usersClient.db('Users');
        const users = await usersDb.collection('FormexUsers').find({}).toArray();
        
        if (users.length === 0) {
            console.log('No se encontraron usuarios');
        } else {
            users.forEach(user => {
                console.log(`\nEmail: ${user.email}`);
                console.log(`Creado: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
                console.log(`Actualizado: ${user.updatedAt ? new Date(user.updatedAt).toLocaleString() : 'N/A'}`);
            });
        }

        console.log('\n📊 DATOS DE CÁMARAS:');
        const db = formexClient.db('Formex');
        
        // Listar todas las colecciones
        const collections = await db.listCollections().toArray();
        const formexCollections = collections.filter(col => col.name.startsWith('FormexCam'));

        if (formexCollections.length === 0) {
            console.log('No se encontraron colecciones de Formex');
            return;
        }

        // Mostrar datos de cada colección
        for (const col of formexCollections) {
            console.log(`\n📊 Colección: ${col.name}`);
            
            // Obtener estadísticas
            const count = await db.collection(col.name).countDocuments();
            console.log(`Total de registros: ${count}`);

            // Obtener el rango de fechas
            const dateRange = await db.collection(col.name).aggregate([
                {
                    $group: {
                        _id: null,
                        minDate: { $min: '$timestamp' },
                        maxDate: { $max: '$timestamp' }
                    }
                }
            ]).toArray();

            if (dateRange.length > 0) {
                const { minDate, maxDate } = dateRange[0];
                console.log(`Rango de fechas: ${minDate.toLocaleString()} hasta ${maxDate.toLocaleString()}`);
            }

            // Mostrar los últimos 5 registros
            console.log('\nÚltimos 5 registros:');
            const lastRecords = await db.collection(col.name)
                .find({})
                .sort({ timestamp: -1 })
                .limit(5)
                .toArray();

            lastRecords.forEach(record => {
                console.log(`\nFecha: ${record.timestamp.toLocaleString()}`);
                console.log('Datos:', JSON.stringify(record.data, null, 2));
            });
        }    } catch (error) {
        console.error('Error:', error);
    } finally {
        await formexClient.close();
        await usersClient.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    showFormexData().catch(console.error);
}

module.exports = { showFormexData };
