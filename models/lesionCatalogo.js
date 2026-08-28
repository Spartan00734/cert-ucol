// models/lesionCatalogo.js
const mongoose = require('mongoose');

const lesionCatalogoSchema = new mongoose.Schema({
  zona: {
    type: String,
    required: true,
    trim: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Evitar duplicados por zona+nombre
lesionCatalogoSchema.index({ zona: 1, nombre: 1 }, { unique: true });

module.exports = mongoose.model('LesionCatalogo', lesionCatalogoSchema);
