CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(25) NOT NULL UNIQUE,
  nombre VARCHAR(50) NOT NULL,
  apellidos VARCHAR(50) NOT NULL,
  telefono VARCHAR(15) NOT NULL,
  correo VARCHAR(80) NOT NULL UNIQUE,
  direccion VARCHAR(200),
  contrasena VARCHAR(255) NOT NULL,
  tipo_cliente ENUM('persona','empresa') NOT NULL DEFAULT 'persona',
  nombre_empresa VARCHAR(100),
  nit VARCHAR(20),
  rol ENUM('cliente','administrador') NOT NULL DEFAULT 'cliente',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS proveedores (
  id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
  nombre_proveedor VARCHAR(120) NOT NULL,
  telefono VARCHAR(9) NOT NULL,
  direccion VARCHAR(250) NOT NULL,
  contacto VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS flores (
  id_flor INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor INT,
  nombre VARCHAR(80) NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'tallo',
  stock INT NOT NULL DEFAULT 0,
  stock_minimo INT NOT NULL DEFAULT 20,
  costo_unitario DECIMAL(10,2) NOT NULL,
  dias_vida INT NOT NULL DEFAULT 7,
  FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
);

CREATE TABLE IF NOT EXISTS ramos (
  id_ramo INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria INT,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(25) NOT NULL UNIQUE,
  descripcion VARCHAR(300),
  precio DECIMAL(10,2) NOT NULL,
  costo_empaque DECIMAL(10,2) NOT NULL DEFAULT 0,
  imagen VARCHAR(255),
  es_complemento TINYINT(1) NOT NULL DEFAULT 0,
  stock INT,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);

CREATE TABLE IF NOT EXISTS receta_ramos (
  id_receta INT AUTO_INCREMENT PRIMARY KEY,
  id_ramo INT,
  id_flor INT,
  cantidad INT NOT NULL,
  UNIQUE KEY uq_receta_ramo_flor (id_ramo, id_flor),
  FOREIGN KEY (id_ramo) REFERENCES ramos(id_ramo),
  FOREIGN KEY (id_flor) REFERENCES flores(id_flor)
);

CREATE TABLE IF NOT EXISTS zonas_entrega (
  id_zona INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  costo_envio DECIMAL(10,2) NOT NULL,
  tiempo_estimado_min INT NOT NULL
);

CREATE TABLE IF NOT EXISTS cargos (
  id_cargo INT AUTO_INCREMENT PRIMARY KEY,
  cargo VARCHAR(50) NOT NULL,
  salario DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS empleados (
  id_empleado INT AUTO_INCREMENT PRIMARY KEY,
  id_cargo INT,
  id_usuario INT UNIQUE,
  nombre VARCHAR(50) NOT NULL,
  apellido VARCHAR(50) NOT NULL,
  correo VARCHAR(80) NOT NULL,
  telefono VARCHAR(9),
  dui VARCHAR(12) NOT NULL,
  direccion VARCHAR(255),
  FOREIGN KEY (id_cargo) REFERENCES cargos(id_cargo),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT,
  id_empleado INT,
  id_zona INT,
  tipo_entrega ENUM('domicilio','tienda') NOT NULL DEFAULT 'domicilio',
  fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_entrega DATE NOT NULL,
  hora_desde TIME NOT NULL,
  hora_hasta TIME NOT NULL,
  nombre_destinatario VARCHAR(100) NOT NULL,
  telefono_destinatario VARCHAR(10) NOT NULL,
  direccion_entrega VARCHAR(250),
  dedicatoria VARCHAR(300),
  subtotal DECIMAL(10,2) NOT NULL,
  descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
  costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  metodo_pago ENUM('efectivo','transferencia','tarjeta') NOT NULL,
  pagado TINYINT(1) NOT NULL DEFAULT 0,
  estado CHAR(1) NOT NULL DEFAULT 'P' CHECK (estado IN ('P','R','C','E','X')),
  motivo_cancelacion VARCHAR(200),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado),
  FOREIGN KEY (id_zona) REFERENCES zonas_entrega(id_zona)
);

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id_detalle_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT,
  id_ramo INT,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
  FOREIGN KEY (id_ramo) REFERENCES ramos(id_ramo)
);

CREATE TABLE IF NOT EXISTS solicitudes_personalizadas (
  id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  codigo VARCHAR(25) NOT NULL UNIQUE,
  ocasion VARCHAR(80) NOT NULL,
  descripcion VARCHAR(600) NOT NULL,
  presupuesto DECIMAL(10,2),
  fecha_entrega DATE NOT NULL,
  nombre_destinatario VARCHAR(100) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Solicitud recibida',
  fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS entregas (
  id_entrega INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT UNIQUE,
  id_repartidor INT,
  fecha_hora_salida DATETIME,
  fecha_hora_entrega DATETIME,
  recibido_por VARCHAR(100),
  foto_confirmacion VARCHAR(255),
  observaciones VARCHAR(250),
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
  FOREIGN KEY (id_repartidor) REFERENCES empleados(id_empleado)
);

CREATE TABLE IF NOT EXISTS mermas (
  id_merma INT AUTO_INCREMENT PRIMARY KEY,
  id_flor INT,
  id_pedido INT,
  cantidad INT NOT NULL,
  motivo VARCHAR(100) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_flor) REFERENCES flores(id_flor),
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
);

CREATE TABLE IF NOT EXISTS resenas (
  id_resena INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT,
  id_ramo INT,
  fecha DATE NOT NULL DEFAULT (CURRENT_DATE),
  calificacion INT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario VARCHAR(500),
  visible TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_resena_usuario_ramo (id_usuario, id_ramo),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_ramo) REFERENCES ramos(id_ramo)
);

CREATE TABLE IF NOT EXISTS fechas_especiales (
  id_fecha INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT,
  descripcion VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  dias_aviso INT NOT NULL DEFAULT 7,
  recordar TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT,
  id_pedido INT,
  tipo VARCHAR(20) NOT NULL,
  mensaje VARCHAR(250) NOT NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
);

-- Omit initial data when the catalog has already been seeded.
SET @telephaty_seed_required := NOT EXISTS (SELECT 1 FROM ramos WHERE codigo = 'RAM-001');

INSERT INTO categorias (nombre, descripcion)
SELECT 'Amor', 'Ramos para expresar amor y romanticismo.' WHERE @telephaty_seed_required
UNION ALL SELECT 'Cumpleaños', 'Ramos para festejar momentos especiales.' WHERE @telephaty_seed_required
UNION ALL SELECT 'Condolencias', 'Arreglos para acompañar en duelo.' WHERE @telephaty_seed_required
UNION ALL SELECT 'Corporativo', 'Arreglos elegantes para eventos y oficinas.' WHERE @telephaty_seed_required
UNION ALL SELECT 'Complementos', 'Accesorios y detalles complementarios.' WHERE @telephaty_seed_required;

INSERT INTO zonas_entrega (nombre, costo_envio, tiempo_estimado_min)
SELECT 'San Salvador', 3.00, 30 WHERE @telephaty_seed_required
UNION ALL SELECT 'Área metropolitana', 5.00, 45 WHERE @telephaty_seed_required
UNION ALL SELECT 'Retiro en tienda', 0.00, 0 WHERE @telephaty_seed_required;

INSERT INTO proveedores (nombre_proveedor, telefono, direccion, contacto)
SELECT 'Floral Fusión', '22223333', 'San Salvador', 'María López' WHERE @telephaty_seed_required
UNION ALL SELECT 'Green Bloom', '22224444', 'Soyapango', 'José Ramos' WHERE @telephaty_seed_required;

INSERT INTO flores (id_proveedor, nombre, unidad, stock, stock_minimo, costo_unitario, dias_vida)
SELECT 1, 'Rosa', 'tallo', 120, 20, 0.75, 5 WHERE @telephaty_seed_required
UNION ALL SELECT 1, 'Tulipán', 'tallo', 60, 20, 0.60, 4 WHERE @telephaty_seed_required
UNION ALL SELECT 2, 'Girasol', 'tallo', 80, 15, 0.90, 6 WHERE @telephaty_seed_required
UNION ALL SELECT 2, 'Orquídea', 'tallo', 40, 10, 1.25, 7 WHERE @telephaty_seed_required;

INSERT INTO ramos (id_categoria, nombre, codigo, descripcion, precio, costo_empaque, imagen, es_complemento, stock, activo)
SELECT 1, 'Ramo de Amor', 'RAM-001', 'Ramo romántico con rosas y tulipanes.', 32.00, 3.50, 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=640&q=75', 0, NULL, 1 WHERE @telephaty_seed_required
UNION ALL SELECT 1, 'Bouquet Clásico', 'RAM-002', 'Arreglo clásico para regalar en cualquier ocasión.', 28.00, 2.80, 'https://raw.githubusercontent.com/josuevega2895r-art/TELEPATHY-FLORISTERIA/master/web/public/images/bouquet-clasico.png', 0, NULL, 1 WHERE @telephaty_seed_required
UNION ALL SELECT 5, 'Caja de regalo', 'COM-001', 'Complemento para entrega premium.', 12.00, 1.50, 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=640&q=75', 1, 25, 1 WHERE @telephaty_seed_required;

INSERT INTO receta_ramos (id_ramo, id_flor, cantidad)
SELECT 1, 1, 10 WHERE @telephaty_seed_required
UNION ALL SELECT 1, 2, 5 WHERE @telephaty_seed_required
UNION ALL SELECT 2, 1, 8 WHERE @telephaty_seed_required
UNION ALL SELECT 2, 3, 6 WHERE @telephaty_seed_required;

INSERT INTO cargos (cargo, salario)
SELECT 'Vendedor', 450.00 WHERE @telephaty_seed_required
UNION ALL SELECT 'Repartidor', 350.00 WHERE @telephaty_seed_required
UNION ALL SELECT 'Administrador', 800.00 WHERE @telephaty_seed_required;

INSERT INTO usuarios (codigo, nombre, apellidos, telefono, correo, direccion, contrasena, tipo_cliente, rol, activo)
SELECT 'USR-001', 'Admin', 'Sistema', '70000001', 'admin@telephaty.com', 'San Salvador', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92Q/EXhJp5iEh1Gyo0/4S', 'persona', 'administrador', 1 WHERE @telephaty_seed_required
UNION ALL SELECT 'USR-002', 'Ana', 'López', '70000002', 'ana@correo.com', 'Soyapango', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92Q/EXhJp5iEh1Gyo0/4S', 'persona', 'cliente', 1 WHERE @telephaty_seed_required
UNION ALL SELECT 'USR-003', 'Carlos', 'Mora', '70000003', 'carlos@correo.com', 'San Salvador', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92Q/EXhJp5iEh1Gyo0/4S', 'persona', 'cliente', 1 WHERE @telephaty_seed_required;

INSERT INTO empleados (id_cargo, id_usuario, nombre, apellido, correo, telefono, dui, direccion)
SELECT 3, 1, 'Admin', 'Sistema', 'admin@telephaty.com', '70000001', '00000000-0', 'San Salvador' WHERE @telephaty_seed_required;

INSERT INTO pedidos (id_usuario, id_empleado, id_zona, tipo_entrega, fecha_entrega, hora_desde, hora_hasta, nombre_destinatario, telefono_destinatario, direccion_entrega, dedicatoria, subtotal, descuento, costo_envio, total, metodo_pago, pagado, estado)
SELECT 2, 1, 1, 'domicilio', '2026-11-06', '10:00:00', '12:00:00', 'María', '70001001', 'Col. San Benito', 'Para ti', 32.00, 3.20, 3.00, 31.80, 'tarjeta', 1, 'E' WHERE @telephaty_seed_required;

INSERT INTO detalle_pedidos (id_pedido, id_ramo, cantidad, precio_unitario)
SELECT 1, 1, 1, 32.00 WHERE @telephaty_seed_required;

INSERT INTO entregas (id_pedido, id_repartidor, fecha_hora_salida, fecha_hora_entrega, recibido_por, foto_confirmacion, observaciones)
SELECT 1, 1, '2026-11-06 09:30:00', '2026-11-06 11:15:00', 'María', NULL, 'Entrega exitosa' WHERE @telephaty_seed_required;

INSERT INTO resenas (id_usuario, id_ramo, fecha, calificacion, comentario, visible)
SELECT 2, 1, '2026-11-06', 5, 'Excelente ramo, llegó perfecto.', 1 WHERE @telephaty_seed_required;

INSERT INTO fechas_especiales (id_usuario, descripcion, fecha, dias_aviso, recordar)
SELECT 2, 'Aniversario', '2026-11-30', 7, 1 WHERE @telephaty_seed_required
UNION ALL SELECT 3, 'Cumpleaños', '2026-12-10', 5, 1 WHERE @telephaty_seed_required;

INSERT INTO notificaciones (id_usuario, id_pedido, tipo, mensaje, leida)
SELECT 2, 1, 'entrega', 'Tu pedido ha sido entregado.', 0 WHERE @telephaty_seed_required
UNION ALL SELECT 1, 1, 'pedido', 'Nuevo pedido recibido.', 0 WHERE @telephaty_seed_required;
