const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const ConfigSchema = new Schema({
  lastFolio:    { type: Number, default: 0 },
  ambulancias:  { type: [String], default: [] },
  tiposServicio:{ type: [String], default: [] }
}, { timestamps: true });

module.exports = model('Config', ConfigSchema);
