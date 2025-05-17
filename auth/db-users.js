const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      w: 'majority',  // Asegura escritura en disco
      retryWrites: true
    };

    await mongoose.connect(process.env.MONGODB_URI_USERS, options);
    console.log('✅ MongoDB Users DB conectada');

    // Manejar desconexiones
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB Users DB desconectada. Intentando reconectar...');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('error', (err) => {
      console.error('Error en conexión MongoDB Users:', err);
      setTimeout(connectDB, 5000);
    });

  } catch (error) {
    console.error('Error conectando a MongoDB Users:', error);
    throw error;
  }
};

module.exports = connectDB;
