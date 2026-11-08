# Especificación de API, Pruebas y Despliegue

## Sistema de Pedidos y Entregas — Telephaty

## Generalidades API

- Base: `/api` · Formato: JSON · Autenticación: `Authorization: Bearer <JWT>`
- Errores en formato `{ "error": "mensaje en español" }` con el código HTTP correspondiente (400 validación, 401 sin sesión, 403 sin permiso, 404 no encontrado, 409 conflicto).
- Rutas protegidas con middleware `fnVerificarToken` y, cuando aplique, `fnExigirRol('administrador')`.
- Salud del servicio: `GET /api/salud` (usado por Railway).

## Endpoints

| Método | Ruta                                  | Rol                 | Descripción                                                        |
| ------ | ------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| POST   | /api/auth/registro                    | Público             | Registro de cliente                                                |
| POST   | /api/auth/login                       | Público             | Inicio de sesión; devuelve JWT con rol                             |
| GET    | /api/categorias                       | Público             | Lista de categorías                                                |
| GET    | /api/ramos                            | Público             | Catálogo con filtros (`categoria`, `precioMin`, `precioMax`) y disponibilidad calculada |
| GET    | /api/ramos/:id                        | Público             | Detalle del ramo                                                   |
| POST   | /api/ramos                            | Administrador       | Crear ramo con su receta                                           |
| PUT    | /api/ramos/:id                        | Administrador       | Editar ramo y receta                                               |
| PATCH  | /api/ramos/:id/activo                 | Administrador       | Activar o desactivar ramo                                          |
| GET    | /api/zonas                            | Autenticado         | Zonas de entrega y costo de envío                                  |
| POST   | /api/pedidos                          | Cliente / Admin     | Crear pedido (valida RS-01, RS-02, RS-04; calcula RS-03 y RS-08)   |
| GET    | /api/pedidos                          | Cliente / Admin     | Cliente: sus pedidos. Administrador: todos, con filtros `estado` y `fecha` |
| GET    | /api/pedidos/:id                      | Cliente / Admin     | Detalle de un pedido                                               |
| PATCH  | /api/pedidos/:id/estado               | Administrador       | Cambiar estado (R descuenta flores, C exige repartidor, E registra recepción) |
| PATCH  | /api/pedidos/:id/cancelar             | Cliente / Admin     | Cancelar pedido (RS-05)                                            |
| PATCH  | /api/pedidos/:id/pago                 | Administrador       | Marcar el pedido como pagado y registrar método                    |
| GET    | /api/entregas                         | Administrador       | Entregas del día y pendientes                                      |
| PATCH  | /api/entregas/:id                     | Administrador       | Asignar repartidor, registrar salida, entrega y foto de confirmación |
| GET    | /api/flores                           | Administrador       | Inventario de flores                                               |
| POST   | /api/flores                           | Administrador       | Crear flor                                                         |
| PUT    | /api/flores/:id                       | Administrador       | Editar flor o registrar ingreso de stock                           |
| POST   | /api/mermas                           | Administrador       | Registrar merma y descontar stock                                  |
| GET    | /api/ramos/:id/resenas                | Público             | Reseñas visibles de un ramo                                        |
| POST   | /api/resenas                          | Cliente             | Crear reseña (RS-07)                                               |
| PATCH  | /api/resenas/:id/visible              | Administrador       | Ocultar o mostrar reseña                                           |
| GET    | /api/fechas-especiales                | Cliente             | Mis fechas especiales                                              |
| POST   | /api/fechas-especiales                | Cliente             | Crear fecha especial                                               |
| DELETE | /api/fechas-especiales/:id            | Cliente             | Eliminar fecha especial                                            |
| GET    | /api/notificaciones                   | Autenticado         | Notificaciones del usuario                                         |
| PATCH  | /api/notificaciones/:id/leida         | Autenticado         | Marcar notificación como leída                                     |
| GET    | /api/reportes/ventas                  | Administrador       | Ventas por `periodo` = mensual, trimestral o anual                 |
| GET    | /api/reportes/top-ramos               | Administrador       | Top 10 ramos más vendidos                                          |
| GET    | /api/reportes/categorias              | Administrador       | Ventas por categoría                                               |
| GET    | /api/reportes/mermas                  | Administrador       | Mermas por flor y periodo                                          |
| GET    | /api/empleados                        | Administrador       | Lista de empleados                                                 |
| POST   | /api/empleados                        | Administrador       | Crear empleado                                                     |
| PUT    | /api/empleados/:id                    | Administrador       | Editar empleado                                                    |

## Endpoints implementados en la API

| Grupo | Rutas | Comportamiento |
| ----- | ----- | -------------- |
| Salud y acceso | `GET /api/salud`, `POST /api/auth/registro`, `POST /api/auth/login` | Salud del servicio, registro salvadoreño `+503` y JWT por rol. |
| Catálogo | `GET /api/categorias`, `GET /api/ramos`, `GET /api/ramos/:id`, `POST /api/ramos`, `PUT /api/ramos/:id`, `PATCH /api/ramos/:id/activo` | Consulta, filtros, disponibilidad y administración transaccional de ramos y recetas. |
| Pedidos | `GET /api/zonas`, `GET/POST /api/pedidos`, `GET /api/pedidos/:id`, `PATCH /api/pedidos/:id/estado`, `/cancelar`, `/pago`, `POST /api/pedidos/personalizados` | Filtrado, RS-01 a RS-05, descuento del primer pedido, costos por zona, seguimiento, cancelación con motivo y pagos sin cobro. |
| Entregas | `GET /api/entregas`, `PATCH /api/entregas/:id` | Consulta de entregas pendientes/próximas, asignación de repartidor, salida, recepción y foto. |
| Inventario | `GET/POST /api/flores`, `PUT /api/flores/:id`, `GET/POST /api/inventario`, `PATCH /api/inventario/:id`, `POST /api/mermas` | Consulta y actualización de existencias; registro transaccional de mermas. |
| Reseñas | `GET /api/ramos/:id/resenas`, `POST /api/resenas`, `PATCH /api/resenas/:id/visible` | Reseñas visibles; RS-07, máximo una por cliente y ramo y moderación administrativa. |
| Datos de cliente | `GET/POST /api/fechas-especiales`, `DELETE /api/fechas-especiales/:id`, `GET /api/notificaciones`, `PATCH /api/notificaciones/:id/leida` | Fechas propias del cliente y notificaciones protegidas por usuario. |
| Administración | `GET /api/reportes/ventas`, `/top-ramos`, `/categorias`, `/mermas`; `GET/POST /api/empleados`, `PUT /api/empleados/:id` | Reportes y gestión de empleados protegidos por rol administrador. |

Las operaciones que modifican varios registros usan transacciones y las consultas usan parámetros. Las tareas diarias se programan con `node-cron` para avisos de stock bajo, pedidos sin iniciar próximos a la entrega y fechas especiales. El modo local de prueba solo emula los flujos que tienen datos de respaldo; rutas que requieren MySQL devuelven 503 explícito en lugar de simular un resultado.

La factura se consulta dentro de la respuesta de creación y de la lista de pedidos; no existe una ruta independiente de factura. La solicitud personalizada permanece como “Solicitud recibida” hasta cotizarse y no genera una factura de compra.

## Estructura de carpetas

```
telephaty/
├─ backend/
│  └─ src/ (config, middlewares, rutas, controladores, servicios, tareas)
├─ shared/ (servicios, theme.js, validaciones)
├─ web/
├─ mobile/
└─ database/ (schema.mysql.sql)
```

## Pruebas automatizadas actuales (Jest + Supertest)

Ejecutar con `npm --prefix backend test`. La suite actual tiene doce pruebas de API sobre login, registro +503, categorías, pedidos/factura, solicitudes personalizadas, inventario, catálogo, autorización, horario de entrega y máximo de cinco pedidos activos por cliente. `NODE_ENV=test` fuerza el respaldo local para no acceder a Railway.

Casos cubiertos actualmente:

- Salud de API y login administrativo válido.
- Registro cliente con `+503`; rechazo de teléfono sin prefijo.
- Listado de categorías.
- Creación/listado de pedido y contenido de factura.
- Creación de solicitud personalizada y aparición en Mis pedidos.
- Ajuste de inventario y creación de ramo.
- Rechazo de rutas administrativas para clientes y de recursos autenticados sin sesión.
- Rechazo de entregas fuera del horario permitido y del sexto pedido activo por cliente.

La tabla siguiente conserva casos de aceptación pendientes o con cobertura parcial; no implica que todas esas rutas o flujos estén automatizados.

| ID    | Caso                                                                    | Resultado esperado                                        |
| ----- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| PR-01 | Registro con correo ya existente                                        | 409 con mensaje de correo duplicado                       |
| PR-02 | Login con credenciales correctas e incorrectas                          | 200 con JWT y rol / 401                                   |
| PR-03 | Cliente intenta crear un ramo                                           | 403 (RS-06)                                               |
| PR-04 | Crear pedido válido                                                     | 201; totales correctos; entrega creada                    |
| PR-06 | Crear pedido con entrega a menos de 2 horas o fuera de horario          | 400 (RS-02)                                               |
| PR-07 | Crear pedido de un ramo sin flores suficientes                          | 409 (RS-04)                                               |
| PR-08 | Primer pedido de un cliente                                             | Descuento del 10% aplicado (RS-08)                        |
| PR-09 | Cambiar estado a "En preparación"                                       | Stock de flores descontado según la receta                |
| PR-10 | Cambiar estado a "En camino" sin repartidor                             | 409                                                       |
| PR-11 | Cliente cancela un pedido Pendiente / En preparación                    | 200 / 403 (RS-05)                                         |
| PR-12 | Administrador cancela un pedido en preparación                          | Flores usadas registradas como merma                      |
| PR-13 | Reseña de un ramo sin pedido entregado                                  | 403 (RS-07)                                               |
| PR-14 | Reporte de ventas mensual con pedidos entregados                        | Totales coinciden con la suma de pedidos Entregados       |
| PR-15 | Tarea diaria de alertas con una flor bajo el stock mínimo               | Notificación creada para el administrador                 |

## Despliegue en Railway

1. Crear un proyecto en Railway y agregar el servicio **MySQL**.
2. En Beekeeper, conecta a la base elegida en Railway y ejecuta todo `database/schema.mysql.sql` con **Run All** en una misma sesión. El archivo no fuerza un nombre de base y omite el seed si ya existe `RAM-001`.
3. Agregar el servicio `api` desde el repositorio con directorio raíz `backend/`; comando de inicio `npm start`.
4. Configurar en `api` `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `JWT_SECRET` y `NODE_ENV=production`. No subir `backend/.env`; usar variables del servicio. El `.env.example` es solo plantilla local.
5. Comprobar la conexión con `npm --prefix backend run db:check` antes de guardar el administrador con `npm --prefix backend run seed:admin`.
6. Importar el repositorio en Vercel con raíz `web/`, build `npm run build`, salida `dist` y `VITE_API_URL` apuntando a la URL pública de `api` terminada en `/api`.
7. Verificar `GET /api/salud`, login cliente/admin, catálogo, solicitud personalizada, pedido y factura imprimible.

## Checklist antes de entregar

- [ ] Prefijos y comentarios de funciones cumplen las reglas de codificación
- [ ] Todas las consultas están parametrizadas y las operaciones críticas usan transacción
- [ ] Contraseñas almacenadas con hash y sin credenciales en el repositorio
- [ ] Pruebas PR-01 a PR-15 en verde
- [ ] Diseño responsive revisado en 320px, 768px y 1280px
- [ ] APK `release` generado y artefactos intermedios eliminados