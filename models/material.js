const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MaterialSchema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 80 },

  // ⬇️ Deja de exigir el número y agrega el campo textual
  cantidad: { type: Number, min: 0, default: null }, // opcional (deprecated)
  cantidad_texto: { type: String, required: true, trim: true } // NUEVO: cantidad en texto
}, { timestamps: true });

module.exports = mongoose.model('Material', MaterialSchema);
