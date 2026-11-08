# Telephaty

Sistema de gestión de pedidos y entregas de floristería.

## Estructura

- backend: API con Express + JWT + MySQL
- shared: tema y validaciones reutilizables
- web: front-end React + Vite
- mobile: aplicación React Native con Expo, navegación por rol y API compartida
- database: esquema y seed en MySQL

## Inicio rápido

1. Desde la raíz del monorepo, instalar dependencias del backend, web y móvil:
   - npm install
2. Ejecutar el backend conectado a las variables locales de MySQL/Railway:
   - npm --prefix backend run dev
3. En otra terminal, ejecutar la web:
   - npm --prefix web run dev
4. Abrir la app web en http://localhost:5173. Para móvil, ejecutar `npm --prefix mobile start`.

## Variables de entorno

- backend: `PORT`, `JWT_SECRET`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- web: `VITE_API_URL`
- mobile: `API_URL`

`backend/.env.example` es una plantilla con marcadores, no contiene credenciales. Para una instalación nueva, cópiala a `backend/.env` y reemplaza los marcadores por tus valores. Si ya tienes `backend/.env` conectado a Railway, consérvalo: no lo sobrescribas con la plantilla. En Railway, configura los valores reales como variables del servicio `api`; nunca uses los marcadores de ejemplo como credenciales.

Para inicializar MySQL desde Beekeeper, selecciona primero la base destino (por ejemplo, `railway`), abre `database/schema.mysql.sql` y ejecuta el archivo completo con **Run All** en una misma conexión. El archivo usa la base seleccionada y omite los datos iniciales si `RAM-001` ya existe.

Para una instalación nueva de móvil, copia `mobile/.env.example` a `mobile/.env` y sustituye el dominio de ejemplo por la URL pública de la API Railway terminada en `/api`. No cambies ni sobrescribas el `backend/.env` existente si ya contiene la conexión correcta. La app móvil guarda el JWT usando `expo-secure-store`.

## Alcance implementado

- La API incluye pedidos, estados, cancelación, pagos, zonas, entregas, flores, mermas, reseñas, fechas especiales, notificaciones, reportes y empleados; las rutas administrativas requieren rol administrador.
- Crear pedidos valida el máximo de cinco pedidos activos, la anticipación y horario de entrega, disponibilidad de receta, costo por zona y descuento del primer pedido. Las operaciones que afectan varias tablas se ejecutan en transacciones.
- La app móvil Expo contiene acceso/registro, inicio por rol, catálogo, pedidos, alta de pedidos, inventario, reportes y perfil. Las vistas de inventario y reportes consumen endpoints protegidos.
- El modo de prueba no consulta ni modifica Railway. Las pruebas usan el respaldo local con `NODE_ENV=test`.

La aplicación web todavía no contiene una pantalla conectada para cada endpoint administrativo y el APK no se ha compilado; revisa las notas de las especificaciones antes de considerar esos flujos terminados.

## Administrador inicial

Con MySQL configurado en `backend/.env`, guarda o actualiza el administrador con:

```bash
npm --prefix backend run seed:admin
```

Por defecto usa `admin@telephaty.com` y `12345678`. Puedes definir `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el entorno antes de ejecutar el comando. La contraseña se almacena con hash bcrypt.

## Reglas principales

- Autenticación JWT con roles `cliente` y `administrador`
- API protegida según permisos
- Base de datos MySQL en `database/schema.mysql.sql` (esquema y datos iniciales juntos)
- Datos locales de respaldo cuando no hay MySQL activo
