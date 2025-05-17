const mongoose = require('mongoose');

// Habilitar buffering de comandos hasta que la conexión esté abierta
mongoose.set('bufferCommands', true);
// Extender el tiempo de buffer antes de timeout (60 s)
mongoose.set('bufferTimeoutMS', 60000);

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI no definida');

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      w: 'majority',  // Asegura escritura en disco
      retryWrites: true
    };

    const conn = await mongoose.connect(uri, options);
    console.log(`MongoDB FormEx conectado: ${conn.connection.host}`);

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
