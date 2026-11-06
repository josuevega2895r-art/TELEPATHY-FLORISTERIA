# Telephaty

Sistema de gestión de pedidos y entregas de floristería.

## Estructura

- backend: API con Express + JWT + MySQL
- shared: tema y validaciones reutilizables
- web: front-end React + Vite
- mobile: estructura base para Expo
- database: esquema y seed en MySQL

## Inicio rápido

1. Instalar dependencias del backend y la web:
   - npm --prefix backend install
   - npm --prefix web install
2. Ejecutar el backend:
   - npm --prefix backend run dev
3. Ejecutar la web:
   - npm --prefix web run dev
4. Abrir la app web en http://localhost:5173

## Variables de entorno

- backend: `PORT`, `JWT_SECRET`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- web: `VITE_API_URL`
- mobile: `API_URL`

Para desarrollo local, copia `backend/.env.example` a `backend/.env` y completa tus valores. En Railway, configura esas variables en el servicio `api`; no subas el `.env` con credenciales al repositorio.

Para inicializar MySQL desde Beekeeper, selecciona primero la base destino (por ejemplo, `railway`), abre `database/schema.mysql.sql` y ejecuta el archivo completo con **Run All** en una misma conexión. El archivo usa la base seleccionada y omite los datos iniciales si `RAM-001` ya existe.

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
