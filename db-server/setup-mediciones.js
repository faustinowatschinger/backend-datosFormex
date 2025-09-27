require('dotenv').config();
const { connectFormexDB, getFormexConnection } = require('./db-formex');

/**
 * Script para crear los índices necesarios en la colección mediciones
 * y configurar el validador de esquema
 */
async function setupMedicionesCollection() {
    try {
        console.log('🔧 Conectando a la base de datos...');
        await connectFormexDB();
        
        const conn = getFormexConnection();
        const db = conn.useDb('formex');
        
        console.log('📊 Configurando colección mediciones...');
        
        // Crear la colección con validador
        try {
            await db.createCollection('medicions', {
                validator: {
                    $jsonSchema: {
                        bsonType: "object",
                        required: ["frigorificoId", "camaraId", "ts"],
                        properties: {
                            frigorificoId: {
                                bsonType: "objectId",
                                description: "frigorificoId must be an ObjectId and is required"
                            },
                            camaraId: {
                                bsonType: "string",
                                minLength: 1,
                                description: "camaraId must be a non-empty string and is required"
                            },
                            ts: {
                                bsonType: ["date", "number"],
                                description: "ts must be a date or timestamp number and is required"
                            },
                            temp: {
                                bsonType: ["number", "null"],
                                description: "temp must be a number if provided"
                            }
                        }
                    }
                }
            });
            console.log('✅ Colección medicions creada con validador');
        } catch (error) {
            if (error.code === 48) {
                console.log('ℹ️ La colección medicions ya existe');
            } else {
                throw error;
            }
        }

        const collection = db.collection('medicions');

        // Crear índices
        console.log('📈 Creando índices...');
        
        // Índice para consultas ordenadas por timestamp descendente
        await collection.createIndex(
            { frigorificoId: 1, camaraId: 1, ts: -1 },
            { name: 'ix_frigo_camara_ts_desc' }
        );
        console.log('✅ Índice ix_frigo_camara_ts_desc creado');

        // Índice único para prevenir duplicados
        await collection.createIndex(
            { frigorificoId: 1, camaraId: 1, ts: 1 },
            { unique: true, name: 'ux_frigo_camara_ts' }
        );
        console.log('✅ Índice único ux_frigo_camara_ts creado');

        // Mostrar índices existentes
        const indexes = await collection.indexes();
        console.log('\n📋 Índices en la colección medicions:');
        indexes.forEach(index => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        console.log('\n🎉 Configuración de mediciones completada exitosamente');
        
        await conn.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error configurando mediciones:', error);
        process.exit(1);
    }
}

// Ejecutar solo si este archivo es llamado directamente
if (require.main === module) {
    setupMedicionesCollection();
}

module.exports = { setupMedicionesCollection };