const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI no definida');

    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      dbName: 'Formex',  // Especificar explícitamente el nombre de la base de datos
      w: 'majority',     // Asegurar escritura en disco
      retryWrites: true
    };    await mongoose.connect(uri, options);
    console.log(`MongoDB FormEx conectado: ${mongoose.connection.host}`);
    
    // Verificar la conexión y listar las colecciones
    const db = mongoose.connection.useDb('Formex');
    
    // Verificar colecciones existentes usando la referencia nativa de MongoDB
    const collections = await db.db.listCollections().toArray();
    console.log('📁 Estado inicial de la base de datos Formex:');
    if (collections.length === 0) {
      console.log('   → No hay colecciones. Se crearán automáticamente cuando lleguen datos.');
    } else {
      console.log('   → Colecciones encontradas:', collections.map(c => c.name));
    }

    // Manejar desconexiones
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB FormEx desconectada. Intentando reconectar...');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('error', (err) => {
      console.error('Error en conexión MongoDB FormEx:', err);
      setTimeout(connectDB, 5000);
    });

  } catch (error) {
    console.error('Error en conexión FormEx BD:', error.message);
    throw error;
  }
};

module.exports = connectDB;
