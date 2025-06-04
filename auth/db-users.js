const mongoose = require('mongoose');
const userSchema = require('./modelo-user');

let usersConnection;
let User;

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      w: 'majority',     // Asegurar escritura en disco
      j: true,           // Asegurar escritura en journal
      retryWrites: true,
      maxPoolSize: 50,   // Tamaño máximo del pool de conexiones
      minPoolSize: 5     // Mantener al menos 5 conexiones abiertas
    };

    usersConnection = await mongoose.createConnection(process.env.MONGODB_URI_USERS, options).asPromise();
    console.log('✅ MongoDB Users DB conectada');

    User = usersConnection.model('User', userSchema, 'FormexUsers');

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

const getUserModel = () => {
  if (!User) {
    throw new Error('User model not initialized');
  }
  return User;
};

module.exports = { connectDB, getUserModel };
