# Especificaciones de Diseño (UI/UX)

## Sistema de Pedidos y Entregas — Telephaty

## Generalidades

Estilo **"botánico romántico"**: acabado delicado y cálido, formas suaves, acuarelas sutiles y trazos de hojas y pétalos. Sensación elegante, fresca y cercana, que transmita emoción y cuidado.

- Bordes muy redondeados (16–24px) en tarjetas, botones e imágenes de ramos.
- Ilustraciones en línea orgánica (pétalos, hojas, tallos) como fondo decorativo en zonas vacías, nunca sobre texto.
- Fotografía del ramo como protagonista en el catálogo (proporción 4:5).
- Iconos outline, trazo medio, esquinas curvas.
- Microinteracciones suaves (ver Especificación de Animaciones).
- El estilo visual (paleta, tipografía, bordes, iconografía) es **el mismo en Web y en Móvil**; cambian la disposición, la navegación y algunos patrones de interacción.
- Dos experiencias dentro de la misma app según el rol: **Cliente** (tipo tienda) y **Administrador** (tipo panel de gestión).

## Paleta de colores

- Primario (verde hoja): `#2E4A3B`
- Primario oscuro: `#1D3128`
- Acento rosa pétalo: `#D9788F`
- Acento durazno: `#F2A68B`
- Acento dorado (producto premium): `#C9A25A`
- Fondo principal: `#FFF9F5` (crema)
- Fondo secundario: `#F6E8E4` (rosa claro)
- Éxito: `#4F8A5B`
- Información: `#6C8EAD`
- Advertencia: `#E0A93B`
- Error: `#C2453D`
- Texto principal: `#2B2A29`
- Texto secundario: `#6F6865`

Reglas de contraste: texto blanco sobre verde primario; texto `#2B2A29` sobre rosa y durazno.

**Colores de estado del pedido:**

| Estado          | Color     |
| --------------- | --------- |
| Pendiente       | `#E0A93B` |
| En preparación  | `#D9788F` |
| En camino       | `#6C8EAD` |
| Entregado       | `#4F8A5B` |
| Cancelado       | `#C2453D` |

## Tipografía

- Encabezados: "Playfair Display" (serif elegante) — 600/700
- Cuerpo/UI: "Nunito Sans" — 400/600
- Escala Web: H1 30px, H2 24px, H3 18px, Body 15px, Caption 13px
- Escala Móvil: H1 26px, H2 21px, H3 17px, Body 15px, Caption 12px
  - En móvil se reduce ligeramente la escala de encabezados para evitar quiebres de línea forzados.

## Tamaños de pantalla (responsive)

- Mobile: 320–599px → 1 columna; el menú hamburguesa y sus paneles deben permanecer dentro del viewport
- Tablet: 600–1023px → 2 columnas, menú colapsable
- Desktop: 1024px+ → grid de catálogo; el menú web se despliega desde el botón hamburguesa
- Espaciado base: múltiplos de 4px

---

## Plataforma Web (Desktop / Tablet)

### Navegación

- **Cliente y administrador (web actual):** botón hamburguesa a la izquierda del buscador; el menú es un `aside` desplegable. Para clientes muestra Catálogo y Mis pedidos; para administradores muestra Dashboard, Pedidos, Catálogo, Inventario, Entregas y Reportes.
- Buscador: texto “Buscar pedido o ramo” para clientes y “Buscar pedidos, clientes o catálogo” para administración.
- Los paneles de notificaciones y configuración quedan dentro del viewport móvil y se cierran al hacer clic fuera o pulsar Escape.
- Breadcrumbs en pantallas internas (ej. Pedidos > Pedido #124).

### Layout

- **Catálogo (cliente actual):** tarjetas de ramos en grid responsive con foto, nombre, precio y acción Crear pedido. Incluye “Pedir ramo personalizado”, que solicita ocasión, preferencias, presupuesto opcional, destinatario y fecha.
- **Detalle de ramo:** foto grande a la izquierda; nombre, descripción, precio, cantidad, reseñas a la derecha.
- **Nuevo pedido (web actual):** formulario modal con producto, cantidad, fecha/hora de entrega, destinatario, teléfono, dirección, dedicatoria y método de pago. Al confirmar, muestra una factura interna con opción de imprimir/guardar como PDF.
- **Dashboard (administrador actual):** métricas basadas en pedidos, ventas, alertas de inventario y catálogo; tabla de pedidos recientes.
- **Mis pedidos (cliente actual):** lista de pedidos y solicitudes personalizadas; sin exportación CSV. Los pedidos confirmados muestran “Descargar factura en PDF”.
- Modales centrados con overlay oscuro (opacidad 40%), ancho máximo 560px.
- Formularios extensos (nuevo ramo con receta, nueva flor) en panel lateral deslizante (drawer) de 440px.

### Interacción

- Hover states visibles en botones, tarjetas de ramos, filas de tabla e íconos.
- Tooltips en íconos de acción (editar, desactivar, ver detalle) tras 400ms.
- Atajos de teclado básicos: `Esc` cierra modales, `Enter` confirma formularios.
- Ordenamiento de columnas por click en el encabezado de tabla.
- Botón "Imprimir" en Reportes (`window.print()`).

---

## Plataforma Móvil (App; diseño objetivo pendiente)

### Navegación

- **Cliente:** tab bar inferior con Inicio, Catálogo, [FAB central "Nuevo pedido"], Mis pedidos y Perfil.
- **Administrador:** tab bar inferior con Inicio, Pedidos, [FAB central "Nuevo pedido"], Inventario y Reportes (las Entregas se ven como pestaña dentro de Pedidos).
- FAB circular en rosa `#D9788F` con ícono de flor.
- Header simple: título de pantalla + ícono de notificaciones. Sin sidebar.
- Navegación interna mediante stack (push/pop) con botón de retroceso en la esquina superior izquierda.

### Layout

- Una sola columna, scroll vertical.
- Tarjetas de KPIs del administrador en carrusel horizontal deslizable.
- Catálogo en grid de 2 columnas; listados de pedidos en tarjetas con foto del ramo a la izquierda y datos clave (estado, fecha, total) a la derecha.
- Seguimiento del pedido con línea de tiempo vertical.
- Formularios en pantalla completa con botón "Cerrar" (X) arriba y botón de acción primaria fijo abajo.
- Reportes como tarjetas resumidas con métricas clave; el detalle tabular completo queda solo en Web.

### Interacción

- Sin estados hover; estados de "presión" con retroalimentación táctil (escala 0.97).
- Gestos: swipe horizontal en carruseles, pull-to-refresh en listas, swipe lateral en tarjetas de pedido para acciones rápidas (administrador: avanzar de estado).
- Notificaciones push del sistema operativo además de las notificaciones in-app.
- Áreas táctiles mínimas de 44x44px.
- Cámara integrada para la foto de confirmación de entrega.

---

## Estructura de pantallas

**Cliente**

```
─ Login / Registro
─ Inicio (destacados y ocasiones)
─ Catálogo
   └ Detalle de ramo (reseñas)
─ Nuevo pedido (ramos → entrega y pago → confirmación)
─ Mis pedidos
   └ Seguimiento del pedido
─ Fechas especiales
─ Perfil
```

**Administrador**

```
─ Login
─ Inicio (Dashboard)
─ Pedidos (por estado) / Entregas
─ Catálogo (ramos y recetas)
─ Inventario (flores, mermas)
─ Alertas
─ Reportes
─ Reseñas / Empleados
```

Navegación web actual: menú hamburguesa a la izquierda del buscador, con opciones según el rol. Navegación móvil con tab bar y FAB central: diseño objetivo pendiente de implementar.

## Implementación web actual

- El menú hamburguesa y los desplegables de la campana/engranaje tienen entradas suaves y respetan `prefers-reduced-motion`.
- El aside de navegación es compartido visualmente, pero sus opciones cambian según rol. La web cliente comienza en Catálogo y la administrativa en Dashboard.
- Los ramos personalizados se registran como solicitud pendiente de cotización, no como pedido pagado ni factura.