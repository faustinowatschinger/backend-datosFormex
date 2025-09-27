// Script de configuración manual de MongoDB para mediciones
// Ejecutar estos comandos directamente en MongoDB shell (mongo) o MongoDB Compass

// 1. Crear colección medicions con validador
db.createCollection("medicions", {
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

// 2. Crear índices necesarios
db.medicions.createIndex({ frigorificoId: 1, camaraId: 1, ts: -1 }, { name: "ix_frigo_camara_ts_desc" });
db.medicions.createIndex({ frigorificoId: 1, camaraId: 1, ts: 1 }, { unique: true, name: "ux_frigo_camara_ts" });

// 3. Crear colección frigorificos si no existe
db.frigorificos.insertOne({
  nombre: "Frigorífico Principal",
  apiKey: "test-api-key-12345",
  ubicacion: "Planta Principal",
  createdAt: new Date()
});

// 4. Verificar la configuración
print("=== VERIFICACIÓN ===");

// Mostrar índices creados
print("Índices en medicions:");
db.medicions.getIndexes().forEach(index => print("  - " + index.name + ": " + JSON.stringify(index.key)));

// Mostrar frigoríficos
print("Frigoríficos:");
db.frigorificos.find().forEach(frigo => print("  - " + frigo.nombre + " (API Key: " + frigo.apiKey + ")"));

// Mostrar colecciones FormexCam existentes
print("Colecciones FormexCam existentes:");
db.getCollectionNames().filter(name => name.startsWith("FormexCam")).forEach(name => {
  const count = db.getCollection(name).countDocuments();
  print("  - " + name + ": " + count + " documentos");
});

print("=== CONFIGURACIÓN COMPLETADA ===");