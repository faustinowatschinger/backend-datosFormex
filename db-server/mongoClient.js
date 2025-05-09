// /db-server/mongoClient.js
const { MongoClient } = require('mongodb');


if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI no definida en .env');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
});

let dbInstance = null;

async function connectMongo() {
  if (dbInstance) return dbInstance;
  await client.connect();
  // El `db()` sin parámetros toma la base definida en la URI (ej scada)
  dbInstance = client.db();
  console.log(`✅ MongoDB (nativo) conectado: ${client.s.url}`);
  return dbInstance;
}

module.exports = connectMongo;
