const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI_USERS);
  console.log('✅ Mongo conectado');
};

module.exports = connectDB;
