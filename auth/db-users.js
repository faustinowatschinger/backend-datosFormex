const mongoose = require('mongoose');
 
let usersConnection = null;

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      w: 'majority',     // Asegurar escritura en disco        // Asegurar escritura en journal
      j: true,           // Asegurar escritura en journal
      retryWrites: true,
      maxPoolSize: 50,   // Tamaño máximo del pool de conexiones
      minPoolSize: 5,    // Mantener al menos 5 conexiones abiertas
      dbName: 'users'    // Especificar explícitamente la base de datos
    };

    usersConnection = await mongoose
      .createConnection(process.env.MONGODB_URI_USERS, options)
      .asPromise();
    module.exports.usersConnection = usersConnection;
    console.log('✅ MongoDB Users DB conectada');

    // Manejar desconexiones
    usersConnection.on('disconnected', () => {
      console.log('MongoDB Users DB desconectada. Intentando reconectar...');
      setTimeout(connectDB, 5000);
    });

    usersConnection.on('error', (err) => {
      console.error('Error en conexión MongoDB Users:', err);
      setTimeout(connectDB, 5000);
    });

  } catch (error) {
    console.error('Error conectando a MongoDB Users:', error);
    throw error;
  }
};

const getUsersConnection = () => usersConnection;

module.exports = {
  connectUsersDB: connectDB,
  getUsersConnection,
  usersConnection
};
