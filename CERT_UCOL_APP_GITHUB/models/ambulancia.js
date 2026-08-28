// models/ambulancia.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AmbulanciaSchema = new Schema({
  folio: Number,
  salida: String,
  llegada: String,
  fecha: String,
  unidad: String,
  radio: String,
  lugar: String,
  tipo: String,
  solicitado: String,
  ubicacion: String
});

module.exports = mongoose.model('Ambulancia', AmbulanciaSchema);
