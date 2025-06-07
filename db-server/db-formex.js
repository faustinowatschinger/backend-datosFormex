const mongoose = require('mongoose');

let formexConnection = null;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI no definida');
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      dbName: 'formex',  // Especificar explícitamente el nombre de la base de datos
      w: 'majority',     // Asegurar escritura en disco          // Asegurar escritura en journal
      j: true,           // Asegurar escritura en joural
      retryWrites: true,
      maxPoolSize: 50,   // Tamaño máximo del pool de conexiones
      minPoolSize: 5     // Mantener al menos 5 conexiones abiertas
    };
    formexConnection = await mongoose
      .createConnection(uri, options)
      .asPromise();
    module.exports.formexConnection = formexConnection;
    console.log(`MongoDB Formex conectado: ${formexConnection.host}`);

    // Verificar la conexión y listar las colecciones
    const db = formexConnection.useDb('formex')
    
    // Verificar colecciones existentes usando la referencia nativa de MongoDB
    const collections = await db.db.listCollections().toArray();
    console.log('📁 Estado inicial de la base de datos Formex:');
    if (collections.length === 0) {
      console.log('   → No hay colecciones. Se crearán automáticamente cuando lleguen datos.');
    } else {
      console.log('   → Colecciones encontradas:', collections.map(c => c.name));
    }

    // Manejar desconexiones
    formexConnection.on('disconnected', () => {
      console.log('MongoDB FormEx desconectada. Intentando reconectar...');
      setTimeout(connectDB, 5000);
    });

   formexConnection.on('error', (err) => {
      console.error('Error en conexión MongoDB FormEx:', err);
      setTimeout(connectDB, 5000);
    });

  } catch (error) {
    console.error('Error en conexión FormEx BD:', error.message);
    throw error;
  }
};

const getFormexConnection = () => formexConnection;

module.exports = {
  connectFormexDB: connectDB,
  getFormexConnection,
  formexConnection
};
