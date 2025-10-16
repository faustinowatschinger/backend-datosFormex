const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getUsersConnection } = require('./db-users');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  company: {
    type: String,
    required: false,
    trim: true
  },
  passwordHash: {
    type: String,
    required: false // Hacer opcional por compatibilidad
  },
  password: {
    type: String,
    required: false // Campo legacy para usuarios antiguos
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'rejected'],
    default: 'pending'
  },
  role: {
    type: String,
    enum: ['3W', 'Global Fresh', 'Formex'],
    default: null
  },
  authorizedBy: {
    type: String,
    default: null
  },
  authorizedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

/* Helper para validar contraseña */
userSchema.methods.comparePassword = async function (plain) {
  // Para usuarios migrados que pueden tener diferentes estructuras
  if (this.passwordHash) {
    return await bcrypt.compare(plain, this.passwordHash);
  } else if (this.password) {
    // Manejar usuarios con campo password legacy
    return await bcrypt.compare(plain, this.password);
  }
  return false;
};

let UserModel;

function getUserModel() {
  if (!UserModel) {
    const conn = getUsersConnection();
    if (!conn) {
      throw new Error('Conexión a Users DB no establecida');
    }
    UserModel = conn.model('User', userSchema, 'FormexUsers');
  }
  return UserModel;
}

module.exports = getUserModel;
