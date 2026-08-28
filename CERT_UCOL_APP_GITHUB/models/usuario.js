const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  correo:   { type: String, required: true, unique: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['admin', 'viewer'], default: 'viewer' }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
