const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getUsersConnection } = require('./db-users');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

/* Helper para validar contraseña */
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
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
