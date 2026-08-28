// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const Snapshot = require('./models/snapshot');
const Config = require('./models/config');
const LesionCatalogo = require('./models/lesionCatalogo');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 4000;

// ==== Conexión a Mongo ====
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ Error: La URI de MongoDB no está definida en .env');
  process.exit(1);
}
mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('La conexión a la base de datos de MongoDB Atlas es correcta'))
  .catch(err => console.log(err));

// ==== Modelos ====
const Paciente   = require('./models/paciente');
const Material   = require('./models/material');
const Ambulancia = require('./models/ambulancia');
const Usuario    = require('./models/usuario');

// ==== App config ====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

const snapshotsDir = path.join(__dirname, 'public', 'snapshots');
if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ==== Sesión ====
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('❌ Error: SESSION_SECRET no está definida en .env');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ==== Flash simple (en session) ====
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});
function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

// ==== Usuario actual en vistas ====
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ==== Helpers de rol ====
function normalizeRole(user) {
  if (!user) return null;
  // Por seguridad, usuarios antiguos sin role se consideran viewer
  const role = user.role || 'viewer';
  return { ...user, role };
}
function isAdminUser(user) {
  const u = normalizeRole(user);
  return !!u && u.role === 'admin';
}
function requireAdmin(req, res, next) {
  if (!isAdminUser(req.session.user)) {
    setFlash(req, 'danger', 'No tienes permisos para realizar esta acción');
    return res.redirect('/');
  }
  next();
}

// ==== Auth guard global ====
app.use((req, res, next) => {
  if (!req.session.user && req.path !== '/login') {
    return res.redirect('/login');
  }
  next();
});

// ==== Utilidades ====
// Fecha ISO (YYYY-MM-DD)
function todayISO() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

async function getNextFolio() {
  let config = await Config.findOne({});
  if (!config) {
    config = await Config.create({ lastFolio: 1 });
    return 1;
  }
  const nextFolio = (config.lastFolio || 0) + 1;
  config.lastFolio = nextFolio;
  await config.save();
  return nextFolio;
}

// ==== Rutas de vistas ====
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// Registro SOLO para admin
app.get('/registro', requireAdmin, (req, res) => {
  res.render('registro', { errors: [], formData: {} });
});

// Formulario de paciente (AHORA: cualquier usuario autenticado)
app.get('/paciente', async (req, res) => {
  try {
    // Semilla base de lesiones por zona (solo para asegurarnos que hay algo)
    const baseLesionesSeed = {
      'Cabeza y cuello': [
        'Traumatismo Craneoencefálico',
        'Fractura de cráneo',
        'Herida en cuero cabelludo',
        'Lesión cervical',
        'Herida facial',
        'Contusión facial',
        'Fractura maxilar',
        'Cuerpo extraño en ojo'
      ],
      'Tórax': [
        'Contusión torácica',
        'Fractura de costillas',
        'Neumotórax sospechado',
        'Herida penetrante en tórax',
        'Dolor torácico súbito',
        'Traumatismo de tórax cerrado',
        'Dificultad respiratoria aguda',
        'Lesión esternal'
      ],
      'Abdomen y pelvis': [
        'Dolor abdominal agudo',
        'Herida penetrante abdominal',
        'Sospecha de hemorragia interna',
        'Trauma cerrado abdominal',
        'Dolor en pelvis',
        'Fractura de pelvis',
        'Contusión abdominal',
        'Distensión abdominal'
      ],
      'Extremidades superiores': [
        'Fractura de húmero',
        'Fractura de radio/cúbito',
        'Luxación de hombro',
        'Luxación de codo',
        'Herida en mano',
        'Contusión en brazo',
        'Esguince de muñeca',
        'Amputación parcial de dedo'
      ],
      'Extremidades inferiores': [
        'Fractura de fémur',
        'Fractura de tibia/peroné',
        'Esguince de tobillo',
        'Luxación de rodilla',
        'Contusión en pierna',
        'Herida en pie',
        'Dolor intenso en rodilla',
        'Amputación parcial de pie'
      ],
      'Columna vertebral': [
        'Dolor lumbar agudo',
        'Dolor dorsal agudo',
        'Sospecha de lesión medular',
        'Caída desde altura',
        'Dolor cervical con trauma',
        'Rigidez de cuello post-trauma',
        'Trauma directo en columna',
        'Lumbalgia incapacitante'
      ],
      'General': [
        'Fractura Cerrada',
        'Fractura Abierta',
        'Fractura Conminuta',
        'Fractura Transversal',
        'Fractura Oblicua',
        'Fractura Espiroidea',
        'Fractura por Impacto',
        'Fractura por Estrés (Craneal)',
        'Fractura por Depresión (Craneal)',
        'Fractura por Compresión',
        'Quemadura Leve (1°)',
        'Quemadura Moderada (2°)',
        'Quemadura Grave (3°)',
        'Corte Superficial',
        'Corte Profundo',
        'Contusión Leve',
        'Contusión Moderada',
        'Contusión Severa',
        'Esguince'
      ]
    };

    const zonasBase = Object.keys(baseLesionesSeed);

    // Sembrar zonas que todavía no tienen NINGUNA lesión
    for (const zona of zonasBase) {
      const countZona = await LesionCatalogo.countDocuments({ zona });
      if (countZona === 0) {
        const docs = baseLesionesSeed[zona].map(nombre => ({ zona, nombre }));
        await LesionCatalogo.insertMany(docs);
      }
    }

    // Traer todo el catálogo ya con las semillas
    const lesiones = await LesionCatalogo
      .find({})
      .sort({ zona: 1, nombre: 1 })
      .lean();

    // Construir lista de zonas (para el select de zona)
    const zonasSet = new Set(zonasBase);
    lesiones.forEach(l => zonasSet.add(l.zona));
    const zonasLesion = Array.from(zonasSet);

    // Mapa zona -> lesiones (para el JS del frontend)
    const lesionesPorZona = {};
    lesiones.forEach(l => {
      if (!lesionesPorZona[l.zona]) lesionesPorZona[l.zona] = [];
      lesionesPorZona[l.zona].push({
        _id: String(l._id),
        nombre: l.nombre
      });
    });

    res.render('paciente', {
      formData: {},
      errors: [],
      zonasLesion,
      lesionesPorZona,
      lesionesLista: lesiones
    });
  } catch (err) {
    console.error(err);
    res.render('paciente', {
      formData: {},
      errors: [{ msg: 'Error al preparar formulario de paciente' }],
      zonasLesion: [],
      lesionesPorZona: {},
      lesionesLista: []
    });
  }
});

// Material (form simple) – cualquier usuario autenticado
app.get('/material', (req, res) => {
  res.render('material');
});

// Listado de materiales – cualquier usuario autenticado
app.get('/materiales', async (req, res) => {
  try {
    const materiales = await Material.find({}).sort({ createdAt: -1 }).lean();
    res.render('materiales', { materiales: materiales || [], formData: {}, errors: [] });
  } catch (err) {
    console.error(err);
    res.render('materiales', { materiales: [], formData: {}, errors: [{ msg: 'Error al obtener materiales' }] });
  }
});

// Ambulancia – cualquier usuario autenticado
app.get('/ambulancia', async (req, res) => {
  try {
    let config = await Config.findOne({});

    if (!config) {
      // Si no existe configuración, la creamos con valores por defecto
      config = await Config.create({
        lastFolio: 1,
        ambulancias: [
          'Ambulancia 1',
          'Ambulancia 2',
          'Ambulancia 3'
        ],
        tiposServicio: [
          'Emergencia médica',
          'Accidente de tráfico',
          'Traslado programado'
        ]
      });
    } else {
      // Si existe pero no tiene catálogos, los rellenamos
      let changed = false;

      if (!Array.isArray(config.ambulancias) || !config.ambulancias.length) {
        config.ambulancias = [
          'Ambulancia 1',
          'Ambulancia 2',
          'Ambulancia 3'
        ];
        changed = true;
      }

      if (!Array.isArray(config.tiposServicio) || !config.tiposServicio.length) {
        config.tiposServicio = [
          'Emergencia médica',
          'Accidente de tráfico',
          'Traslado programado'
        ];
        changed = true;
      }

      if (typeof config.lastFolio !== 'number' || !config.lastFolio) {
        config.lastFolio = 1;
        changed = true;
      }

      if (changed) {
        await config.save();
      }
    }

    const folio  = config.lastFolio || 1;
    const hoy    = todayISO();
    const ambulanciasOptions   = config.ambulancias || [];
    const tiposServicioOptions = config.tiposServicio || [];

    res.render('ambulancia', {
      folio,
      hoy,
      formData: {},
      errors: [],
      ambulanciasOptions,
      tiposServicioOptions
    });
  } catch (err) {
    console.error(err);
    res.render('ambulancia', {
      folio: 1,
      hoy: todayISO(),
      formData: {},
      errors: [{ msg: 'Error al preparar formulario' }],
      ambulanciasOptions: [],
      tiposServicioOptions: []
    });
  }
});

// Vista (estado general) - accesible para admin y trabajadores
app.get('/vista', async (req, res) => {
  try {
    const pacientes  = await Paciente.find({}).lean();
    const materiales = await Material.find({}).lean();
    const servicios  = await Ambulancia.find({}).lean();

    // ==== Recuento detallado de materiales por mes ====
    // Estructura: { [YYYY-MM]: { year, monthIdx, items: { nombreMaterial: totalCant }, totalProductos } }
    const resumenPorMesMap = {};

    materiales.forEach(m => {
      if (!m.createdAt) return;
      const d = new Date(m.createdAt);
      if (isNaN(d)) return;

      const year     = d.getFullYear();
      const monthIdx = d.getMonth(); // 0–11
      const key      = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

      // Sacar cantidad numérica
      let cantidadNum = 0;

      // 1) Si existe campo cantidad numérico, lo usamos primero
      if (typeof m.cantidad === 'number' && !isNaN(m.cantidad)) {
        cantidadNum = m.cantidad;
      } else if (m.cantidad_texto) {
        // 2) Extraemos el primer número que aparezca en la cadena de texto
        const match = String(m.cantidad_texto).match(/(\d+)/);
        if (match) {
          cantidadNum = parseInt(match[1], 10) || 0;
        }
      }

      // Si no pudimos obtener nada, lo dejamos en 0 (no suma)
      const nombreMaterial = (m.nombre || 'Sin nombre').trim() || 'Sin nombre';

      if (!resumenPorMesMap[key]) {
        resumenPorMesMap[key] = {
          year,
          monthIdx,
          items: {},          // nombreMaterial -> total cantidad
          totalProductos: 0   // suma de todas las cantidades del mes
        };
      }

      if (!resumenPorMesMap[key].items[nombreMaterial]) {
        resumenPorMesMap[key].items[nombreMaterial] = 0;
      }

      resumenPorMesMap[key].items[nombreMaterial] += cantidadNum;
      resumenPorMesMap[key].totalProductos += cantidadNum;
    });

    const monthNames = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];

    const resumenMaterialesMes = Object.keys(resumenPorMesMap)
      .sort() // orden cronológico por clave YYYY-MM
      .map(k => {
        const { year, monthIdx, items, totalProductos } = resumenPorMesMap[k];

        const materialesDetallados = Object.keys(items)
          .sort()
          .map(nombre => ({
            nombre,
            cantidad: items[nombre]
          }));

        return {
          key: k,
          label: `${monthNames[monthIdx]} ${year}`,
          materialesDetallados,
          totalProductos
        };
      });

    res.render('vista', {
      pacientes,
      materiales,
      servicios,
      resumenMaterialesMes
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error al obtener los datos');
  }
});

// Historial de snapshots (admins y trabajadores)
app.get('/snapshots', async (req, res) => {
  try {
    const snaps = await Snapshot.find({}).sort({ createdAt: -1 }).lean();
    res.render('snapshots', { snaps });
  } catch (err) {
    console.error(err);
    res.render('snapshots', { snaps: [] });
  }
});

// ==== Guardados ====

// Guardar paciente (AHORA: cualquier usuario autenticado; sin "otro" dinámico)
app.post('/guardar-paciente', async (req, res) => {
  try {
    const {
      nombre, edad, genero, estado_civil, ocupacion, numero_cuenta,
      ta, fc, fr, rp, temperatura,
      lesion,        // texto de lesión existente
      zona_lesion,   // zona del cuerpo
      glasgow, estado, terapeuta,
      pertenencias, responsable, parentesco, delegacion
    } = req.body;

    let lesionFinal = (lesion || '').trim();
    const zonaLimpia = (zona_lesion || '').trim();

    if (zonaLimpia && lesionFinal) {
      lesionFinal = `${zonaLimpia} - ${lesionFinal}`;
    }

    const nuevoPaciente = new Paciente({
      nombre, edad, genero, estado_civil, ocupacion, numero_cuenta,
      ta, fc, fr, rp, temperatura,
      lesion: lesionFinal,
      glasgow, estado, terapeuta,
      pertenencias, responsable, parentesco, delegacion
    });

    await nuevoPaciente.save();
    console.log('Paciente guardado correctamente');
    setFlash(req, 'success', '🧑‍⚕️ Paciente guardado correctamente');
    res.redirect('/paciente');
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'No se pudo guardar el paciente');
    res.redirect('/paciente');
  }
});

// Guardar material (AHORA: cualquier usuario puede agregar)
app.post('/guardar-material', (req, res) => {
  const { nombreMaterial, cantidadMaterial } = req.body;

  const nuevoMaterial = new Material({
    nombre: nombreMaterial,
    cantidad: null,
    cantidad_texto: String(cantidadMaterial || '').trim()
  });

  nuevoMaterial.save()
    .then(() => {
      console.log('Material guardado correctamente');
      setFlash(req, 'success', '📦 Material guardado');
      res.redirect('/materiales');
    })
    .catch(err => {
      console.log(err);
      setFlash(req, 'danger', 'No se pudo guardar el material');
      res.redirect('/materiales');
    });
});

// Guardar materiales en lote (AHORA: cualquier usuario puede agregar lote)
app.post('/guardar-materiales-batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, msg: 'Lista vacía' });
    }

    const docs = items.map(it => ({
      nombre: (it.nombreMaterial || '').trim(),
      cantidad: null,
      cantidad_texto: String(it.cantidadMaterial || '').trim()
    }));

    await Material.insertMany(docs);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, msg: 'Error al guardar' });
  }
});

// Eliminar material (solo ADMIN)
app.post('/materiales/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    await Material.deleteOne({ _id: id });

    setFlash(req, 'warning', '🗑 Material eliminado correctamente');
    res.redirect('/materiales');
  } catch (error) {
    console.error('Error al eliminar material:', error);
    setFlash(req, 'danger', 'No se pudo eliminar el material');
    res.redirect('/materiales');
  }
});

// Guardar ambulancia (AHORA: cualquier usuario, sin modificar catálogos)
app.post('/guardar-ambulancia', async (req, res) => {
  const {
    salida, llegada, fecha,
    unidad, radio, lugar,
    tipo, solicitado, ubicacion
  } = req.body;

  try {
    const folio = await getNextFolio();

    let config = await Config.findOne({});
    if (!config) {
      config = await Config.create({
        lastFolio: folio,
        ambulancias: [],
        tiposServicio: []
      });
    }
    // Solo actualizamos lastFolio, los catálogos se gestionan en /admin/catalogos
    config.lastFolio = folio;
    await config.save();

    const nuevoServicio = new Ambulancia({
      folio,
      salida, llegada, fecha,
      unidad,
      radio, lugar,
      tipo,
      solicitado, ubicacion
    });

    await nuevoServicio.save();
    console.log('Servicio de ambulancia guardado correctamente');
    setFlash(req, 'success', '🚑 Servicio de ambulancia guardado');
    res.redirect('/ambulancia');
  } catch (err) {
    console.log(err);
    setFlash(req, 'danger', 'No se pudo guardar el servicio de ambulancia');
    res.redirect('/ambulancia');
  }
});

// Guardar la vista como PDF (admin y trabajador)
app.post('/guardar-vista', async (req, res) => {
  try {
    const pacientes = await Paciente.find({}).lean();
    const materiales = await Material.find({}).lean();
    const servicios  = await Ambulancia.find({}).lean();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `snapshot-${stamp}.pdf`;
    const absPath  = path.join(snapshotsDir, fileName);
    const pubPath  = `/snapshots/${fileName}`;

    const u = normalizeRole(req.session.user);
    const createdBy = u
      ? {
          id: String(u._id || u.id || ''),
          nombre: u.nombre,
          username: u.username,
          role: u.role
        }
      : null;

    const snapshot = new Snapshot({
      fileName,
      filePath: pubPath,
      pacientes,
      materiales,
      servicios,
      createdAt: now,
      createdBy
    });
    await snapshot.save();

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const cookies = req.headers.cookie || '';
    if (cookies) {
      await page.setExtraHTTPHeaders({ Cookie: cookies });
    }
    await page.goto(`http://localhost:${PORT}/vista`, { waitUntil: 'networkidle2' });
    await page.pdf({ path: absPath, format: 'A4', printBackground: true });
    await browser.close();

    req.session.flash = { type: 'success', message: '📄 Vista guardada como PDF' };
    res.redirect('/snapshots');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'No se pudo guardar el PDF' };
    res.redirect('/vista');
  }
});

// Eliminar snapshot (solo ADMIN)
app.post('/snapshots/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    const snap = await Snapshot.findById(req.params.id);
    if (snap) {
      const absPath = path.join(__dirname, 'public', snap.filePath);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      await Snapshot.deleteOne({ _id: snap._id });
    }
    req.session.flash = { type: 'warning', message: '🗑 Snapshot eliminado' };
  } catch (e) {
    console.error(e);
    req.session.flash = { type: 'danger', message: 'No se pudo eliminar' };
  }
  res.redirect('/snapshots');
});

// Vista de administración de catálogos (solo ADMIN)
app.get('/admin/catalogos', requireAdmin, async (req, res) => {
  try {
    // Config con ambulancias / tipos de servicio
    let config = await Config.findOne({});
    if (!config) {
      config = await Config.create({
        lastFolio: 1,
        ambulancias: [],
        tiposServicio: []
      });
    }

    const ambulancias   = config.ambulancias || [];
    const tiposServicio = config.tiposServicio || [];

    // Catálogo de lesiones
    const lesiones = await LesionCatalogo.find({})
      .sort({ zona: 1, nombre: 1 })
      .lean();

    const zonasSet = new Set();
    lesiones.forEach(l => zonasSet.add(l.zona || 'General'));
    const zonasLesion = Array.from(zonasSet);

    res.render('admin-catalogos', {
      ambulancias,
      tiposServicio,
      lesionesLista: lesiones,
      zonasLesion
    });
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'Error al cargar los catálogos');
    res.redirect('/');
  }
});

// AGREGAR ambulancia al catálogo (solo ADMIN)
app.post('/catalogo/ambulancias/agregar', requireAdmin, async (req, res) => {
  let { nombre } = req.body;
  nombre = (nombre || '').trim();

  try {
    if (!nombre) {
      setFlash(req, 'danger', 'Escribe un nombre de ambulancia.');
      return res.redirect('/admin/catalogos');
    }

    let config = await Config.findOne({});
    if (!config) {
      config = await Config.create({
        lastFolio: 1,
        ambulancias: [],
        tiposServicio: []
      });
    }

    if (!Array.isArray(config.ambulancias)) config.ambulancias = [];

    if (config.ambulancias.includes(nombre)) {
      setFlash(req, 'info', `La ambulancia "${nombre}" ya estaba registrada.`);
      return res.redirect('/admin/catalogos');
    }

    config.ambulancias.push(nombre);
    await config.save();

    setFlash(req, 'success', `Ambulancia "${nombre}" agregada al catálogo.`);
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al agregar la ambulancia al catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// ELIMINAR ambulancia del catálogo (solo ADMIN)
app.post('/catalogo/ambulancias/eliminar', requireAdmin, async (req, res) => {
  const { nombre } = req.body;
  const n = (nombre || '').trim();

  try {
    if (!n) {
      setFlash(req, 'danger', 'Nombre de ambulancia inválido.');
      return res.redirect('/admin/catalogos');
    }

    const config = await Config.findOne({});
    if (!config) {
      setFlash(req, 'danger', 'No hay configuración de catálogos.');
      return res.redirect('/admin/catalogos');
    }

    config.ambulancias = (config.ambulancias || []).filter(a => a !== n);
    await config.save();

    setFlash(req, 'success', `Ambulancia "${n}" eliminada del catálogo.`);
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al eliminar la ambulancia del catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// AGREGAR tipo de servicio al catálogo (solo ADMIN)
app.post('/catalogo/tipos-servicio/agregar', requireAdmin, async (req, res) => {
  let { nombre } = req.body;
  nombre = (nombre || '').trim();

  try {
    if (!nombre) {
      setFlash(req, 'danger', 'Escribe un nombre de tipo de servicio.');
      return res.redirect('/admin/catalogos');
    }

    let config = await Config.findOne({});
    if (!config) {
      config = await Config.create({
        lastFolio: 1,
        ambulancias: [],
        tiposServicio: []
      });
    }

    if (!Array.isArray(config.tiposServicio)) config.tiposServicio = [];

    if (config.tiposServicio.includes(nombre)) {
      setFlash(req, 'info', `El tipo de servicio "${nombre}" ya estaba registrado.`);
      return res.redirect('/admin/catalogos');
    }

    config.tiposServicio.push(nombre);
    await config.save();

    setFlash(req, 'success', `Tipo de servicio "${nombre}" agregado al catálogo.`);
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al agregar el tipo de servicio al catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// ELIMINAR tipo de servicio del catálogo (solo ADMIN)
app.post('/catalogo/tipos-servicio/eliminar', requireAdmin, async (req, res) => {
  const { nombre } = req.body;
  const n = (nombre || '').trim();

  try {
    if (!n) {
      setFlash(req, 'danger', 'Nombre de tipo de servicio inválido.');
      return res.redirect('/admin/catalogos');
    }

    const config = await Config.findOne({});

    if (!config) {
      setFlash(req, 'danger', 'No hay configuración de catálogos.');
      return res.redirect('/admin/catalogos');
    }

    config.tiposServicio = (config.tiposServicio || []).filter(t => t !== n);
    await config.save();

    setFlash(req, 'success', `Tipo de servicio "${n}" eliminado del catálogo.`);
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al eliminar el tipo de servicio del catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// AGREGAR lesión al catálogo (solo ADMIN)
app.post('/catalogo/lesiones/agregar', requireAdmin, async (req, res) => {
  let { zona, nombre } = req.body;
  zona   = (zona   || '').trim() || 'General';
  nombre = (nombre || '').trim();

  if (!nombre) {
    setFlash(req, 'danger', 'Debes seleccionar una zona y escribir el nombre de la lesión.');
    return res.redirect('/admin/catalogos');
  }

  try {
    await LesionCatalogo.findOneAndUpdate(
      { zona, nombre },
      { zona, nombre },
      { upsert: true, new: true }
    );

    setFlash(req, 'success', `Lesión "${nombre}" agregada en zona "${zona}".`);
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al agregar la lesión al catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// ELIMINAR lesión del catálogo (solo ADMIN)
app.post('/catalogo/lesiones/eliminar', requireAdmin, async (req, res) => {
  const { id } = req.body;

  try {
    if (!id) {
      setFlash(req, 'danger', 'ID de lesión inválido.');
      return res.redirect('/admin/catalogos');
    }

    await LesionCatalogo.deleteOne({ _id: id });
    setFlash(req, 'success', 'Lesión eliminada del catálogo.');
    res.redirect('/admin/catalogos');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al eliminar la lesión del catálogo.');
    res.redirect('/admin/catalogos');
  }
});

// ==== ADMIN: Usuarios ====

app.get('/admin/usuarios', requireAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find({})
      .sort({ nombre: 1, username: 1 })
      .lean();

    res.render('admin-usuarios', { usuarios });
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'Error al cargar usuarios');
    res.render('admin-usuarios', { usuarios: [] });
  }
});

// Eliminar usuario (solo ADMIN) – no puede eliminarse a sí mismo
app.post('/admin/usuarios/:id/eliminar', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await Usuario.findById(id);
    if (!user) {
      setFlash(req, 'danger', 'Usuario no encontrado.');
      return res.redirect('/admin/usuarios');
    }

    const current = normalizeRole(req.session.user);

    // Evitar que un admin se elimine a sí mismo
    if (current && String(current._id) === String(user._id)) {
      setFlash(req, 'warning', 'No puedes eliminar tu propia cuenta.');
      return res.redirect('/admin/usuarios');
    }

    // Aquí SÍ se permite eliminar admins (siempre que no sea uno mismo)
    await Usuario.deleteOne({ _id: user._id });

    setFlash(
      req,
      'success',
      `Usuario "${user.username}" eliminado correctamente.`
    );
    res.redirect('/admin/usuarios');
  } catch (e) {
    console.error(e);
    setFlash(req, 'danger', 'Error al eliminar el usuario.');
    res.redirect('/admin/usuarios');
  }
});

// ==== Registro / Login ====
// Crear usuarios (solo ADMIN)
app.post('/registro', requireAdmin, async (req, res) => {
  let { nombre, correo, username, password, role } = req.body;
  if (role !== 'admin' && role !== 'viewer') {
    role = 'viewer'; // viewer = trabajador
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await new Usuario({
      nombre,
      correo,
      username,
      password: hashedPassword,
      role
    }).save();
    console.log('Usuario registrado correctamente');
    setFlash(req, 'success', 'Usuario registrado correctamente.');
    res.redirect('/registro');
  } catch (err) {
    console.log(err);
    setFlash(req, 'danger', 'Error en el registro');
    res.redirect('/registro');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await Usuario.findOne({ username });

    if (!user) {
      console.log('Usuario no encontrado');
      setFlash(req, 'danger', 'Usuario o contraseña inválidos');
      return res.redirect('/login');
    }

    // Compatibilidad: acepta usuarios antiguos con contraseña en texto plano
    // y migra su contraseña a bcrypt después de un inicio de sesión correcto.
    const passwordHashed = /^\$2[aby]\$/.test(user.password);
    const passwordValida = passwordHashed
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!passwordValida) {
      console.log('Contraseña incorrecta');
      setFlash(req, 'danger', 'Usuario o contraseña inválidos');
      return res.redirect('/login');
    }

    if (!passwordHashed) {
      user.password = await bcrypt.hash(password, 12);
      await user.save();
    }

    // Por seguridad, usuarios sin rol definido se consideran viewer.
    const role = user.role || 'viewer';

    req.session.user = {
      _id: user._id,
      nombre: user.nombre,
      username: user.username,
      role
    };

    console.log('Usuario autenticado correctamente', req.session.user);
    setFlash(req, 'success', `¡Bienvenido, ${user.nombre}!`);
    res.redirect('/');
  } catch (err) {
    console.log(err);
    setFlash(req, 'danger', 'Error en la autenticación');
    res.redirect('/login');
  }
});

// ==== Logout ====
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.log(err);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/login');
  });
});

// Eliminar un paciente individual (solo ADMIN)
app.post('/pacientes/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    await Paciente.deleteOne({ _id: req.params.id });
    setFlash(req, 'success', 'Paciente eliminado correctamente.');
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'No se pudo eliminar el paciente.');
  }
  res.redirect('/vista');
});

// Eliminar un material individual (solo ADMIN)
app.post('/materiales/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    await Material.deleteOne({ _id: req.params.id });
    setFlash(req, 'success', 'Material eliminado correctamente.');
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'No se pudo eliminar el material.');
  }
  res.redirect('/vista');
});

// Eliminar un servicio de ambulancia individual (solo ADMIN)
app.post('/servicios/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    await Ambulancia.deleteOne({ _id: req.params.id });
    setFlash(req, 'success', 'Servicio de ambulancia eliminado correctamente.');
  } catch (err) {
    console.error(err);
    setFlash(req, 'danger', 'No se pudo eliminar el servicio de ambulancia.');
  }
  res.redirect('/vista');
});

// ==== Limpiar datos (solo ADMIN) ====
app.post('/limpiar', requireAdmin, async (req, res) => {
  try {
    await Paciente.deleteMany({});
    await Material.deleteMany({});
    await Ambulancia.deleteMany({});
    console.log("Todos los datos han sido eliminados.");
    setFlash(req, 'warning', '🗑 Todos los registros fueron eliminados');
    res.redirect('/vista');
  } catch (err) {
    console.log(err);
    setFlash(req, 'danger', 'Error al limpiar los datos');
    res.redirect('/vista');
  }
});

// ==== Server ====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
