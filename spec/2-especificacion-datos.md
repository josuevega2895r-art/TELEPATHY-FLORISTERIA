# Especificación de Base de Datos

---

## Generalidades

Motor: MySQL (servicio de Railway) · Base seleccionada mediante `MYSQLDATABASE` (por ejemplo, `railway`) · Codificación: `utf8mb4` · Motor de tablas: `InnoDB`
Esquema y datos iniciales: `database/schema.mysql.sql`; no fuerza `CREATE DATABASE` ni `USE` y utiliza la base seleccionada en la conexión.
El seed solo carga datos iniciales cuando todavía no existe `RAM-001`. Ejecutar el archivo completo en una misma sesión de Beekeeper conserva la variable de sesión y evita duplicar el catálogo.

### Relaciones (diagrama lineal)

```
usuarios(1) ──> pedidos(N)
usuarios(1) ──> solicitudes_personalizadas(N)
pedidos(1) ──> detalle_pedidos(N) <── ramos(N)
pedidos(1) ──> entregas(1) <── empleados(N)   [repartidor]
ramos(1) ──> receta_ramos(N) <── flores(N)
flores(N) ──> proveedores(1)
flores(1) ──> mermas(N)
categorias(1) ──> ramos(N)
zonas_entrega(1) ──> pedidos(N)
usuarios(1) ──> resenas(N) <── ramos(N)
usuarios(1) ──> fechas_especiales(N)
usuarios(1) ──> notificaciones(N)
cargos(1) ──> empleados(N) <── usuarios(1)
```

## Tablas

| Principales       | Secundarias       |
| ----------------- | ----------------- |
| usuarios          | cargos            |
| ramos             | categorias        |
| pedidos           | proveedores       |
| detalle_pedidos   | zonas_entrega     |
| solicitudes_personalizadas |           |
| entregas          | receta_ramos      |
| flores            | mermas            |
| empleados         | resenas           |
|                   | fechas_especiales |
|                   | notificaciones    |

### Tabla usuarios

| Campo          | Tipo                            | Restriccion                         |
| -------------- | ------------------------------- | ----------------------------------- |
| id_usuario     | int                             | primary key, auto_increment         |
| codigo         | varchar(25)                     | not null, unique                    |
| nombre         | varchar(50)                     | not null                            |
| apellidos      | varchar(50)                     | not null                            |
| telefono       | varchar(15)                     | not null (`+503` + 8 dígitos locales) |
| correo         | varchar(80)                     | not null, unique                    |
| direccion      | varchar(200)                    |                                     |
| contrasena     | varchar(255)                    | not null (hash bcrypt)              |
| tipo_cliente   | enum('persona','empresa')       | not null, default 'persona'         |
| nombre_empresa | varchar(100)                    |                                     |
| nit            | varchar(20)                     |                                     |
| rol            | enum('cliente','administrador') | not null, default 'cliente'         |
| activo         | tinyint(1)                      | not null, default 1                 |
| fecha_registro | datetime                        | not null, default current_timestamp |

### Tabla categorias

| Campo        | Tipo         | Restriccion                 |
| ------------ | ------------ | --------------------------- |
| id_categoria | int          | primary key, auto_increment |
| nombre       | varchar(60)  | not null                    |
| descripcion  | varchar(200) |                             |

### Tabla ramos

| Campo          | Tipo          | Restriccion                           |
| -------------- | ------------- | ------------------------------------- |
| id_ramo        | int           | primary key, auto_increment           |
| id_categoria   | int           | fk --> categorias(id_categoria)       |
| nombre         | varchar(100)  | not null                              |
| codigo         | varchar(25)   | not null, unique                      |
| descripcion    | varchar(300)  |                                       |
| precio         | decimal(10,2) | not null                              |
| costo_empaque  | decimal(10,2) | not null, default 0                   |
| imagen         | varchar(255)  |                                       |
| es_complemento | tinyint(1)    | not null, default 0                   |
| stock          | int           | solo para complementos (null en ramos con receta) |
| activo         | tinyint(1)    | not null, default 1                   |

### Tabla proveedores

| Campo            | Tipo         | Restriccion                 |
| ---------------- | ------------ | --------------------------- |
| id_proveedor     | int          | primary key, auto_increment |
| nombre_proveedor | varchar(120) | not null                    |
| telefono         | varchar(9)   | not null                    |
| direccion        | varchar(250) | not null                    |
| contacto         | varchar(100) |                             |

### Tabla flores

| Campo          | Tipo          | Restriccion                      |
| -------------- | ------------- | -------------------------------- |
| id_flor        | int           | primary key, auto_increment      |
| id_proveedor   | int           | fk --> proveedores(id_proveedor) |
| nombre         | varchar(80)   | not null                         |
| unidad         | varchar(20)   | not null, default 'tallo'        |
| stock          | int           | not null, default 0              |
| stock_minimo   | int           | not null, default 20             |
| costo_unitario | decimal(10,2) | not null                         |
| dias_vida      | int           | not null, default 7              |

### Tabla receta_ramos

| Campo      | Tipo | Restriccion                              |
| ---------- | ---- | ---------------------------------------- |
| id_receta  | int  | primary key, auto_increment              |
| id_ramo    | int  | fk --> ramos(id_ramo)                    |
| id_flor    | int  | fk --> flores(id_flor)                   |
| cantidad   | int  | not null                                 |
|            |      | unique (id_ramo, id_flor)                |

### Tabla zonas_entrega

| Campo              | Tipo          | Restriccion                 |
| ------------------ | ------------- | --------------------------- |
| id_zona            | int           | primary key, auto_increment |
| nombre             | varchar(60)   | not null                    |
| costo_envio        | decimal(10,2) | not null                    |
| tiempo_estimado_min| int           | not null                    |

### Tabla cargos

| Campo    | Tipo          | Restriccion                 |
| -------- | ------------- | --------------------------- |
| id_cargo | int           | primary key, auto_increment |
| cargo    | varchar(50)   | not null                    |
| salario  | decimal(10,2) | not null                    |

### Tabla empleados

| Campo       | Tipo         | Restriccion                                   |
| ----------- | ------------ | --------------------------------------------- |
| id_empleado | int          | primary key, auto_increment                   |
| id_cargo    | int          | fk --> cargos(id_cargo)                       |
| id_usuario  | int          | fk --> usuarios(id_usuario), unique, nullable |
| nombre      | varchar(50)  | not null                                      |
| apellido    | varchar(50)  | not null                                      |
| correo      | varchar(80)  | not null                                      |
| telefono    | varchar(9)   |                                               |
| dui         | varchar(12)  | not null                                      |
| direccion   | varchar(255) |                                               |

### Tabla pedidos

| Campo                 | Tipo                                  | Restriccion                                   |
| --------------------- | ------------------------------------- | --------------------------------------------- |
| id_pedido             | int                                   | primary key, auto_increment                   |
| id_usuario            | int                                   | fk --> usuarios(id_usuario) (cliente)         |
| id_empleado           | int                                   | fk --> empleados(id_empleado), nullable       |
| id_zona               | int                                   | fk --> zonas_entrega(id_zona), nullable       |
| tipo_entrega          | enum('domicilio','tienda')            | not null, default 'domicilio'                 |
| fecha_pedido          | datetime                              | not null, default current_timestamp           |
| fecha_entrega         | date                                  | not null                                      |
| hora_desde            | time                                  | not null                                      |
| hora_hasta            | time                                  | not null                                      |
| nombre_destinatario   | varchar(100)                          | not null                                      |
| telefono_destinatario | varchar(10)                           | not null                                      |
| direccion_entrega     | varchar(250)                          | obligatoria si tipo_entrega = 'domicilio'     |
| dedicatoria           | varchar(300)                          |                                               |
| subtotal              | decimal(10,2)                         | not null                                      |
| descuento             | decimal(10,2)                         | not null, default 0                           |
| costo_envio           | decimal(10,2)                         | not null, default 0                           |
| total                 | decimal(10,2)                         | not null                                      |
| metodo_pago           | enum('efectivo','transferencia','tarjeta') | not null                                 |
| pagado                | tinyint(1)                            | not null, default 0                           |
| estado                | char(1)                               | check in ('P','R','C','E','X'), default 'P'   |
| motivo_cancelacion    | varchar(200)                          |                                               |

Estados: `P` Pendiente · `R` En preparación · `C` En camino · `E` Entregado · `X` Cancelado

### Tabla detalle_pedidos

| Campo              | Tipo          | Restriccion                   |
| ------------------ | ------------- | ----------------------------- |
| id_detalle_pedido  | int           | primary key, auto_increment   |
| id_pedido          | int           | fk --> pedidos(id_pedido)     |
| id_ramo            | int           | fk --> ramos(id_ramo)         |
| cantidad           | int           | not null                      |
| precio_unitario    | decimal(10,2) | not null                      |

### Tabla solicitudes_personalizadas

| Campo               | Tipo          | Restricción                  |
| ------------------- | ------------- | ---------------------------- |
| id_solicitud        | int           | primary key, auto_increment  |
| id_usuario          | int           | fk --> usuarios(id_usuario), not null |
| codigo              | varchar(25)   | not null, unique             |
| ocasion             | varchar(80)   | not null                     |
| descripcion         | varchar(600)  | not null                     |
| presupuesto         | decimal(10,2) | nullable                     |
| fecha_entrega       | date          | not null                     |
| nombre_destinatario | varchar(100)  | not null                     |
| estado              | varchar(30)   | default 'Solicitud recibida' |
| fecha_solicitud     | datetime      | default current_timestamp    |

### Tabla entregas

| Campo              | Tipo         | Restriccion                                      |
| ------------------ | ------------ | ------------------------------------------------ |
| id_entrega         | int          | primary key, auto_increment                      |
| id_pedido          | int          | fk --> pedidos(id_pedido), unique                |
| id_repartidor      | int          | fk --> empleados(id_empleado), nullable          |
| fecha_hora_salida  | datetime     |                                                  |
| fecha_hora_entrega | datetime     |                                                  |
| recibido_por       | varchar(100) |                                                  |
| foto_confirmacion  | varchar(255) |                                                  |
| observaciones      | varchar(250) |                                                  |

### Tabla mermas

| Campo    | Tipo         | Restriccion                             |
| -------- | ------------ | --------------------------------------- |
| id_merma | int          | primary key, auto_increment             |
| id_flor  | int          | fk --> flores(id_flor)                  |
| id_pedido| int          | fk --> pedidos(id_pedido), nullable     |
| cantidad | int          | not null                                |
| motivo   | varchar(100) | not null                                |
| fecha    | datetime     | not null, default current_timestamp     |

### Tabla resenas

| Campo        | Tipo         | Restriccion                                   |
| ------------ | ------------ | --------------------------------------------- |
| id_resena    | int          | primary key, auto_increment                   |
| id_usuario   | int          | fk --> usuarios(id_usuario)                   |
| id_ramo      | int          | fk --> ramos(id_ramo)                         |
| fecha        | date         | not null, default (current_date)              |
| calificacion | int          | not null, check (calificacion between 1 and 5)|
| comentario   | varchar(500) |                                               |
| visible      | tinyint(1)   | not null, default 1                           |
|              |              | unique (id_usuario, id_ramo)                  |

### Tabla fechas_especiales

| Campo       | Tipo         | Restriccion                     |
| ----------- | ------------ | ------------------------------- |
| id_fecha    | int          | primary key, auto_increment     |
| id_usuario  | int          | fk --> usuarios(id_usuario)     |
| descripcion | varchar(100) | not null                        |
| fecha       | date         | not null                        |
| dias_aviso  | int          | not null, default 7             |
| recordar    | tinyint(1)   | not null, default 1             |

### Tabla notificaciones

| Campo           | Tipo         | Restriccion                             |
| --------------- | ------------ | --------------------------------------- |
| id_notificacion | int          | primary key, auto_increment             |
| id_usuario      | int          | fk --> usuarios(id_usuario) (destinatario) |
| id_pedido       | int          | fk --> pedidos(id_pedido), nullable     |
| tipo            | varchar(20)  | not null ('pedido','entrega','stock','recordatorio') |
| mensaje         | varchar(250) | not null                                |
| leida           | tinyint(1)   | not null, default 0                     |
| fecha           | datetime     | not null, default current_timestamp     |

## Datos iniciales (seed)

**Categorías:** Amor · Cumpleaños · Condolencias · Corporativo · Complementos

**Zonas de entrega:** San Salvador ($3) · Área metropolitana ($5) · Retiro en tienda ($0)

**Cargos:** Vendedor · Repartidor · Administrador

**Catálogo de ramos:**

| Ramo            | Código  | Categoría    | Precio |
| --------------- | ------- | ------------ | ------ |
| Ramo de Amor    | RAM-001 | Amor         | $32    |
| Bouquet Clásico | RAM-002 | Amor         | $28    |
| Caja de regalo  | COM-001 | Complementos | $12    |

## Observacion

- `reportes` no se implementa como tabla física: se genera con `SELECT` agregados sobre `pedidos`, `detalle_pedidos`, `entregas` y `mermas` (ventas mensual/trimestral/anual, top 10 ramos más vendidos, ventas por categoría, mermas por flor).
- Los registros de ramos con historial deben desactivarse, no borrarse.
- Pendiente: añadir índices de consulta en `pedidos(id_usuario, estado)`, `pedidos(fecha_entrega)` y `detalle_pedidos(id_ramo)` al implementar reportes completos.

_Nota:_ El backend se conecta con `mysql2` usando `MYSQLDATABASE` y las demás variables de entorno. Desde Beekeeper se selecciona la base Railway y se ejecuta todo `database/schema.mysql.sql` con `Run All`; el archivo evita repetir el seed si `RAM-001` ya existe.