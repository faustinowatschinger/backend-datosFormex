require('dotenv').config();
const { connectFormexDB, getFormexConnection } = require('./db-formex');

/**
 * Script para migrar datos de las colecciones FormexCamXX a la nueva colección mediciones
 */
async function migrarDatosFormex() {
    try {
        console.log('🔧 Conectando a la base de datos...');
        await connectFormexDB();
        
        const conn = getFormexConnection();
        const db = conn.useDb('formex');
        
        // Obtener el ID del frigorífico (asumiendo que hay uno por defecto)
        // En un escenario real, deberías tener una forma de mapear las cámaras a frigoríficos
        let defaultFrigorifico;
        try {
            defaultFrigorifico = await db.collection('frigorificos').findOne();
            if (!defaultFrigorifico) {
                console.log('⚠️ No se encontró frigorífico. Creando uno por defecto...');
                const result = await db.collection('frigorificos').insertOne({
                    nombre: 'Frigorífico Principal',
                    apiKey: 'default-api-key-12345',
                    ubicacion: 'Principal',
                    createdAt: new Date()
                });
                defaultFrigorifico = { _id: result.insertedId };
            }
        } catch (error) {
            console.log('⚠️ Colección frigorificos no existe. Creando frigorífico por defecto...');
            const result = await db.collection('frigorificos').insertOne({
                nombre: 'Frigorífico Principal',
                apiKey: 'default-api-key-12345',
                ubicacion: 'Principal',
                createdAt: new Date()
            });
            defaultFrigorifico = { _id: result.insertedId };
        }

        console.log(`📋 Usando frigorífico: ${defaultFrigorifico._id}`);

        // Obtener todas las colecciones que empiecen con FormexCam
        const collections = await db.db.listCollections().toArray();
        const formexCollections = collections
            .filter(col => col.name.startsWith('FormexCam'))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (formexCollections.length === 0) {
            console.log('⚠️ No se encontraron colecciones FormexCam para migrar');
            return;
        }

        console.log(`📊 Encontradas ${formexCollections.length} colecciones para migrar:`);
        formexCollections.forEach(col => console.log(`  - ${col.name}`));

        let totalMigrados = 0;
        let totalErrores = 0;

        // Migrar datos de cada colección
        for (const collectionInfo of formexCollections) {
            const colName = collectionInfo.name;
            const camaraId = colName.replace('FormexCam', '');
            
            console.log(`\n🔄 Migrando ${colName} (Cámara ${camaraId})...`);
            
            try {
                const sourceCollection = db.collection(colName);
                const targetCollection = db.collection('mediciones');
                
                // Obtener documentos de la colección fuente
                const documentos = await sourceCollection.find({}).toArray();
                console.log(`  📄 Encontrados ${documentos.length} documentos`);
                
                if (documentos.length === 0) {
                    continue;
                }

                // Transformar y migrar documentos en lotes
                const batchSize = 100;
                let migradosEnColeccion = 0;
                let erroresEnColeccion = 0;

                for (let i = 0; i < documentos.length; i += batchSize) {
                    const batch = documentos.slice(i, i + batchSize);
                    const medicionesBatch = [];

                    for (const doc of batch) {
                        try {
                            const medicion = {
                                frigorificoId: defaultFrigorifico._id,
                                camaraId: camaraId,
                                ts: doc.timestamp || doc.ts || new Date(doc._id.getTimestamp()),
                                temp: doc.temperature !== undefined ? doc.temperature : doc.temp,
                                // Preservar metadatos originales si existen
                                _originalId: doc._id,
                                _originalCollection: colName
                            };

                            // Validar que tenemos los campos requeridos
                            if (!medicion.ts || isNaN(new Date(medicion.ts).getTime())) {
                                console.warn(`    ⚠️ Documento con timestamp inválido: ${doc._id}`);
                                erroresEnColeccion++;
                                continue;
                            }

                            medicionesBatch.push(medicion);
                        } catch (error) {
                            console.warn(`    ⚠️ Error procesando documento ${doc._id}:`, error.message);
                            erroresEnColeccion++;
                        }
                    }

                    // Insertar lote
                    if (medicionesBatch.length > 0) {
                        try {
                            const result = await targetCollection.insertMany(medicionesBatch, { 
                                ordered: false // Continuar aunque algunos documentos fallen
                            });
                            migradosEnColeccion += result.insertedCount;
                        } catch (error) {
                            // Manejar errores de duplicados
                            if (error.code === 11000) {
                                // Contar inserciones exitosas en errores de bulk
                                const insertedCount = error.result ? error.result.insertedCount : 0;
                                migradosEnColeccion += insertedCount;
                                erroresEnColeccion += (medicionesBatch.length - insertedCount);
                                console.warn(`    ⚠️ Algunos documentos ya existen (duplicados)`);
                            } else {
                                erroresEnColeccion += medicionesBatch.length;
                                console.error(`    ❌ Error insertando lote:`, error.message);
                            }
                        }
                    }
                }

                console.log(`  ✅ Migrados: ${migradosEnColeccion}, Errores: ${erroresEnColeccion}`);
                totalMigrados += migradosEnColeccion;
                totalErrores += erroresEnColeccion;

            } catch (error) {
                console.error(`  ❌ Error migrando ${colName}:`, error.message);
                totalErrores += 1;
            }
        }

        // Resumen final
        console.log('\n📊 RESUMEN DE MIGRACIÓN:');
        console.log(`  ✅ Total documentos migrados: ${totalMigrados}`);
        console.log(`  ❌ Total errores: ${totalErrores}`);
        console.log(`  📁 Colecciones procesadas: ${formexCollections.length}`);

        // Mostrar estadísticas de la colección destino
        const medicionesCollection = db.collection('mediciones');
        const totalMediciones = await medicionesCollection.countDocuments();
        const medicionesPorCamara = await medicionesCollection.aggregate([
            {
                $group: {
                    _id: '$camaraId',
                    count: { $sum: 1 },
                    ultimaMedicion: { $max: '$ts' },
                    primeraMedicion: { $min: '$ts' }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log('\n📈 ESTADÍSTICAS DE MEDICIONES:');
        console.log(`  📊 Total de mediciones: ${totalMediciones}`);
        console.log('  📋 Por cámara:');
        medicionesPorCamara.forEach(stat => {
            console.log(`    Cámara ${stat._id}: ${stat.count} mediciones`);
            console.log(`      Primera: ${stat.primeraMedicion}`);
            console.log(`      Última: ${stat.ultimaMedicion}`);
        });

        console.log('\n🎉 Migración completada');
        
        await conn.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

// Ejecutar solo si este archivo es llamado directamente
if (require.main === module) {
    migrarDatosFormex();
}

module.exports = { migrarDatosFormex };