// models/paciente.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PacienteSchema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  edad: { type: Number, required: true, min: 0, max: 120 },
  genero: { type: String, enum: ['masculino','femenino','otro'], required: true },
  ocupacion: { type: String, required: true, trim: true, maxlength: 100 },
  delegacion: { type: String, trim: true, maxlength: 100 },
  ta: { type: String, required: true,  }, // 120/80
  fc: { type: Number, required: true, min: 0, max: 250 },
  fr: { type: Number, required: true, min: 0, max: 80 },
  temperatura: { type: Number, required: true, min: 30, max: 45 },
  lesion: { type: String, required: true, trim: true, maxlength: 80 },
  glasgow: { type: Number, required: true, min: 1, max: 15},
  responsable: { type: String, required: true, trim: true, maxlength: 120 },
  parentesco: { type: String, enum: ['padre','hermano','hijo','conyuge','otro'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('Paciente', PacienteSchema);
