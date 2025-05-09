const mongoose = require('mongoose');
// Habilitar buffering de comandos hasta que la conexión esté abierta
mongoose.set('bufferCommands', true);
// Extender el tiempo de buffer antes de timeout (60 s)
mongoose.set('bufferTimeoutMS', 60000);

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI no definida');

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error en conexión BD:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
