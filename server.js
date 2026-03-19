const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const md5     = require('md5');

const app = express();
app.use(cors());
app.use(express.json());

// BD
const db = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 3306
});

// LOGIN
app.post('/login.php', (req, res) => {
  const { correo, contrasena } = req.body;
  const hash = md5(contrasena);
  db.query('SELECT * FROM usuarios WHERE correo=? AND contrasena=?', [correo, hash], (err, rows) => {
    if (err || rows.length === 0) return res.json({ status: 'error', mensaje: 'Credenciales incorrectas' });
    const u = rows[0];
    res.json({ status: 'ok', id_usuario: u.id_usuario, nombre: u.nombre, rol: u.rol });
  });
});

// REGISTRAR
app.post('/registrar.php', (req, res) => {
  const { nombre, correo, contrasena } = req.body;
  const hash = md5(contrasena);
  db.query('INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?,?,?,?)',
    [nombre, correo, hash, 'usuario'], (err) => {
      if (err) return res.json({ status: 'error', mensaje: 'Correo ya registrado' });
      res.json({ status: 'ok', mensaje: 'Cuenta creada' });
    });
});

// PRODUCTOS
app.get('/productos.php', (req, res) => {
  db.query('SELECT * FROM productos WHERE disponible=1', (err, rows) => {
    if (err) return res.json({ status: 'error' });
    res.json(rows);
  });
});

// CREAR PEDIDO
app.post('/crear_pedido.php', (req, res) => {
  const { id_usuario, detalles } = req.body;
  const total = detalles.reduce((s, d) => s + d.precio_unit * d.cantidad, 0);
  db.query('INSERT INTO pedidos (id_usuario, total, estado) VALUES (?,?,?)',
    [id_usuario, total, 'pendiente'], (err, result) => {
      if (err) return res.json({ status: 'error', mensaje: 'Error al crear pedido' });
      const id_pedido = result.insertId;
      const vals = detalles.map(d => [id_pedido, d.id_producto, d.cantidad, d.precio_unit]);
      db.query('INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unit) VALUES ?',
        [vals], (err2) => {
          if (err2) return res.json({ status: 'error', mensaje: 'Error en detalle' });
          res.json({ status: 'ok', id_pedido });
        });
    });
});

// ESTADO PEDIDO
app.get('/estado_pedido.php', (req, res) => {
  const { id_usuario } = req.query;
  db.query('SELECT estado FROM pedidos WHERE id_usuario=? ORDER BY fecha_pedido DESC LIMIT 1',
    [id_usuario], (err, rows) => {
      if (err || rows.length === 0) return res.json({ status: 'error', mensaje: 'Sin pedido' });
      res.json({ status: 'ok', estado: rows[0].estado });
    });
});

// ADMIN - TODOS LOS PEDIDOS
app.get('/admin_pedidos.php', (req, res) => {
  db.query(`SELECT p.*, u.nombre as nombre_usuario 
            FROM pedidos p JOIN usuarios u ON p.id_usuario=u.id_usuario 
            ORDER BY p.fecha_pedido DESC`, (err, rows) => {
    if (err) return res.json({ status: 'error' });
    res.json(rows);
  });
});

// CAMBIAR ESTADO
app.post('/cambiar_estado.php', (req, res) => {
  const { id_pedido, estado } = req.body;
  db.query('UPDATE pedidos SET estado=? WHERE id_pedido=?', [estado, id_pedido], (err) => {
    if (err) return res.json({ status: 'error' });
    res.json({ status: 'ok' });
  });
});

// ADMIN USUARIOS
app.get('/admin_usuarios.php', (req, res) => {
  db.query(`SELECT u.*, COUNT(p.id_pedido) as total_pedidos, COALESCE(SUM(p.total),0) as total_gastado
            FROM usuarios u LEFT JOIN pedidos p ON u.id_usuario=p.id_usuario
            WHERE u.rol='usuario' GROUP BY u.id_usuario`, (err, rows) => {
    if (err) return res.json({ status: 'error' });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('QuickBite API corriendo en puerto ' + PORT));
