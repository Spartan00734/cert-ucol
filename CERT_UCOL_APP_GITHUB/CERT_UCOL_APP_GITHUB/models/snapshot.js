// models/snapshot.js
const { Schema, model } = require('mongoose');

const SnapshotSchema = new Schema({
  fileName:  { type: String, required: true },   // ej: snapshot-20250101-235959.pdf
  filePath:  { type: String, required: true },   // ruta pública: /snapshots/archivo.pdf
  createdAt: { type: Date, default: Date.now },

  // Guardar datos actuales en el momento de generar el PDF
  pacientes:  { type: Array, default: [] },
  materiales: { type: Array, default: [] },
  servicios:  { type: Array, default: [] },

  // Usuario que generó el documento
  createdBy: {
    type: {
      id: String,
      nombre: String,
      username: String,
      role: String
    },
    default: null
  }
});

module.exports = model('Snapshot', SnapshotSchema);
