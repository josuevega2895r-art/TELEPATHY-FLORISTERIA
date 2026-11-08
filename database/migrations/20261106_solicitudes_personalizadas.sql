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