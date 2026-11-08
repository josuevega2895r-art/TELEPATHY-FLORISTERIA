# Especificaciones del Sistema

---

"Creado por":"Keni Odalys Escamilla Sanchez"
"Sistema":"Sistema de gestión de pedidos y entregas de floristería — Telephaty"
"Version":1.0
"Fecha de creacion":07/11/2026

## Vision general

_**Problema:** Los pedidos de ramos llegan por WhatsApp, llamadas y redes sociales y se anotan a mano, lo que genera errores de dirección, fecha u hora, descontrol del inventario de flores y pedidos perdidos en temporadas altas (14 de febrero, 10 de mayo, 2 de noviembre, diciembre). Se propone un sistema digital con catálogo, pedidos, seguimiento de entregas, control de inventario de flores, notificaciones y reportes._
_**Usuario:** Administrador (propietario/gerente, florista y asistente de ventas), Cliente (consulta el catálogo, realiza pedidos y da seguimiento)_
_**Alcance:** Catálogo de ramos, Pedidos, Entregas, Inventario de flores y mermas, Historial, Reseñas, Fechas especiales, Notificaciones, Reportes_
_**Fuera de alcance:** Cobro en línea con pasarela de pago (solo se registra el método de pago y si el pedido está pagado, sin procesar ninguna transacción), Facturación electrónica (DTE) real (la web sí genera una factura interna imprimible/guardable como PDF), Suscripciones florales, Multi-sucursal, Ruteo GPS en tiempo real_
_**Version:** Todas las dependencias actualizadas a la última versión estable tanto backend como frontend_

Se requieren **dos frontends** consumiendo el **mismo backend**. React (web) y React Native (móvil) no comparten componentes de UI (CSS vs. StyleSheet, DOM vs. vistas nativas), así que se generan como dos proyectos independientes dentro de un monorepo, compartiendo solo lo que es agnóstico de plataforma.

| Capa                 | Tecnología                                       |
| -------------------- | ------------------------------------------------ |
| Backend (compartido) | Node.js + Express + JWT                          |
| Driver DB            | mysql2 (pool de conexiones, consultas con `?`)   |
| Base de datos        | MySQL (servicio de Railway)                      |
| Tareas programadas   | node-cron (alertas y recordatorios)              |
| Frontend Web         | React + Vite + React Router                      |
| Frontend APK         | React Native + Expo                              |
| Testing              | Jest + Supertest (backend)                       |
| Hosting              | Railway (`api` y `MySQL`); Vercel (`web`)        |

**Qué se comparte entre web y APK:**

- Capa de servicios/API (`axios`, funciones `fnObtenerRamos`, `fnRegistrarPedido`, etc. — la lógica de fetch es igual, solo cambia el storage del token: `localStorage` en web vs. `expo-secure-store` en APK).
- Tokens de diseño: colores y tipografía como objeto JS (`theme.js`) importado en ambos, en vez de duplicar valores.
- Reglas de validación de formularios (correo, teléfono, fecha y hora mínima de entrega, cantidades) como funciones puras reutilizables.

**Qué NO se comparte (implementar distinto en cada uno):**

- Componentes visuales (web usa CSS; APK usa `StyleSheet` + Flexbox nativo de RN).
- Navegación (web: React Router; APK: React Navigation).
- Los breakpoints 600px/1024px del documento de diseño **aplican solo a la versión web**. Para el APK se usa Flexbox relativo y `useWindowDimensions` para adaptarse a distintos tamaños de teléfono/tablet.
- Impresión de reportes: en web `window.print()` o exportar PDF; en APK "compartir/exportar PDF" con `expo-print` y `expo-sharing`.
- Carga de foto de confirmación de entrega: en web `input type="file"`; en APK `expo-image-picker` (cámara).

**Despliegue en Railway:**

- Un proyecto de Railway con dos servicios: `MySQL` (base de datos) y `api` (carpeta `backend/`). La web se publica en Vercel desde `web/`, con build `npm run build`, salida `dist` y `VITE_API_URL` apuntando a la URL pública de `api` terminada en `/api`.
- El backend lee la conexión desde variables de entorno (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`), más `JWT_SECRET` y `PORT`. Nunca se guardan credenciales en el repositorio.
- El esquema y los datos iniciales se cargan juntos con `npm run bd:iniciar` desde `database/schema.mysql.sql`.
- La app móvil apunta a la URL pública del servicio `api` mediante `API_URL` en `app.config.js`.

**Build del APK:** generar con Expo (`expo prebuild` + Gradle), usando JDK 17 y Android SDK sin necesidad de Android Studio completo. Conservar solo el APK final de `release` y limpiar artefactos intermedios (`build/`, caché de Gradle) tras compilar.

**Reglas de codificación obligatorias:**

- Prefijos: `btn-xxxx` (botones), `fnXxxXxx` (funciones), `tb-xxxx` (tablas/grids), `varXxx` (variables)
- Nombres y descripciones únicamente en español
- Cada función debe tener comentario con: nombre, descripción, funcionamiento y qué retorna
- Documentar funciones secundarias con datos específicos que requieran
- Separar código en carpetas `backend/`, `shared/`, `web/`, `mobile/` y `database/` (crearlas si no existen)
- Consultas SQL siempre parametrizadas (`?`), nunca concatenadas
- Operaciones que toquen varias tablas (crear pedido, cambiar estado, cancelar) dentro de una **transacción**
- Todas las dependencias en su versión más reciente estable

Ejemplo de comentario obligatorio:

```js
/**
 * Nombre: fnRegistrarPedido
 * Descripcion: Registra un pedido con su detalle y su entrega.
 * Funcionamiento: Valida RS-01, RS-02 y RS-04, abre una transaccion,
 *   inserta pedido, detalle y entrega, y confirma o revierte.
 * Retorna: Objeto { idPedido, total } o lanza un error con mensaje en español.
 */
```

## Reglas del sistema

| #     | Regla                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RS-01 | Un cliente no puede tener más de 5 pedidos activos simultáneos (estados Pendiente, En preparación o En camino)                                                         |
| RS-02 | La entrega debe programarse con al menos 2 horas de anticipación y dentro del horario de entrega (08:00 a 20:00)                                                       |
| RS-03 | El costo de envío depende de la zona: San Salvador $3, Área metropolitana $5, Retiro en tienda $0 (tabla `zonas_entrega`)                                              |
| RS-04 | Un ramo solo puede pedirse si hay flores suficientes en inventario para su receta; si faltan, se muestra "Agotado temporalmente"                                       |
| RS-05 | El cliente solo puede cancelar un pedido en estado Pendiente. Después solo el administrador, quien registra el motivo; las flores ya usadas se registran como merma    |
| RS-06 | Solo el rol `administrador` puede crear/modificar/eliminar ramos, flores, pedidos (estados), entregas y mermas (middleware de autorización por rol vía JWT)            |
| RS-07 | Una reseña solo la crea un cliente que tenga un pedido Entregado con ese ramo; máximo una reseña por cliente y ramo                                                    |
| RS-08 | El primer pedido de cada cliente recibe 10% de descuento sobre el subtotal, aplicado automáticamente y registrado en `pedidos.descuento`                               |

Reglas de registro adicionales:

- Al crear un pedido (en una sola transacción): validar RS-01, RS-02 y RS-04, calcular `subtotal`, `descuento` (RS-08), `costo_envio` (RS-03) y `total`, insertar `pedidos`, `detalle_pedidos` y `entregas` (si es a domicilio), y notificar al administrador.
- Al pasar un pedido a **En preparación (R)**: descontar de `flores.stock` la cantidad de cada flor según `receta_ramos × cantidad` del detalle (y `ramos.stock` en complementos).
- Al pasar un pedido a **En camino (C)**: exigir un repartidor asignado en `entregas`.
- Al pasar un pedido a **Entregado (E)**: registrar `fecha_hora_entrega`, quién recibió y, opcionalmente, la foto de confirmación.
- Cada cambio de estado genera una notificación al cliente.
- Tareas programadas diarias (`node-cron`): alerta de stock bajo (`stock <= stock_minimo`), alerta de pedidos del día sin iniciar a 3 horas de la entrega y recordatorio al cliente de sus fechas especiales según `dias_aviso`.
- Se registra el método de pago (`efectivo`, `transferencia`, `tarjeta`) y si el pedido está pagado, sin procesar ningún cobro.
- Login unificado: POST /api/auth/login autentica siempre contra `usuarios` (correo + contraseña); el JWT incluye `rol`. El administrador es un usuario con rol='administrador', opcionalmente enlazado a un registro de RR.HH. en `empleados`.
- Los ramos con historial no se eliminan: se desactivan (`activo = 0`).

---

## Perfiles y permisos

- Cliente: Acceso al catálogo, realizar pedidos estándar, solicitar ramos personalizados y consultar sus pedidos. En la web solo ve Catálogo y Mis pedidos; las herramientas administrativas se ocultan.
- Administrador: Dashboard y gestión de pedidos, catálogo, inventario, entregas y reportes en la web.

## Implementación web actual

- Registro de clientes con teléfono de El Salvador (`+503` y ocho dígitos locales) e inicio de sesión JWT por rol.
- La navegación web usa React Router; las vistas internas conservan rutas directas y `web/vercel.json` redirige el historial de rutas a la SPA.
- Después del ingreso, el administrador inicia en Dashboard y el cliente en Catálogo.
- El cliente puede solicitar un ramo personalizado indicando ocasión, preferencias, presupuesto opcional, destinatario y fecha. La solicitud queda en Mis pedidos con estado `Solicitud recibida`, pendiente de cotización.
- La confirmación de un pedido estándar muestra una factura interna con códigos de factura/pedido/producto, comprador y correo, precio, entrega y pago. Puede imprimirse o guardarse como PDF; no es factura electrónica DTE.
- La base MySQL usa `MYSQLDATABASE`; el archivo `database/schema.mysql.sql` contiene esquema y seed. El seed inicial se omite si ya existe `RAM-001` para conservar los ramos existentes.
- Para desarrollo local se usa `backend/.env.example` como plantilla; en Railway los valores reales se configuran como variables del servicio. Comandos disponibles en backend: `npm run db:check` y `npm run seed:admin`.
- La pantalla de pedidos permite avanzar estados, asignar repartidor y registrar la recepción; las operaciones se conectan a las rutas protegidas de la API.

## Implementación móvil actual

- Aplicación Expo independiente con navegación inferior para cliente y administrador, almacenamiento JWT en `expo-secure-store`, catálogo, pedidos, alta de pedido, inventario, reportes y perfil.
- `API_URL` debe apuntar al servicio público de Railway terminado en `/api`; `mobile/.env.example` contiene solo una URL marcadora.
- Las funciones móviles no cubiertas por las pantallas actuales (por ejemplo, cámara para confirmación, alta de fechas especiales, reseñas, moderación, edición de empleados, filtros y reportes adicionales) siguen pendientes de interfaz aunque la API ya exponga sus rutas.