// /db-server/mongoClient.js
const { MongoClient } = require('mongodb');

async function connectMongo(retries = 5, delay = 5000) {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    waitQueueTimeoutMS: 30000,
  });

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Intento de conexión ${i + 1} a MongoDB...`);
      await client.connect();
      console.log('✅ Conectado a MongoDB en:', uri);
      return client.db();
    } catch (err) {
      console.error(`Intento ${i + 1}/${retries} fallido:`, err.message);
      if (i === retries - 1) throw err;
      console.log(`Reintentando en ${delay/1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = connectMongo;
