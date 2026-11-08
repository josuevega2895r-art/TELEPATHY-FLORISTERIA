# Especificación de Animaciones y Microinteracciones

## Sistema de Pedidos y Entregas — Telephaty

## Principios

- Suaves y naturales, inspiradas en el crecimiento de una flor: sin movimientos bruscos ni rebotes exagerados.
- Duración general entre 150ms y 400ms; solo las animaciones de celebración pasan de 1000ms.
- Easing estándar: `cubic-bezier(0.22, 1, 0.36, 1)` (salida suave). Para entradas y salidas de pantalla completa: `ease-in-out`.
- Nunca bloquear la interacción mientras se anima.
- **Accesibilidad:** si el sistema tiene activado "reducir movimiento" (`prefers-reduced-motion` en web, `AccessibilityInfo.isReduceMotionEnabled` en móvil), se reemplazan por cambios de opacidad de 100ms o se omiten.

## Herramientas

- Web: transiciones CSS y `@keyframes`; `framer-motion` solo si una animación lo requiere.
- Móvil: `react-native-reanimated` y `Animated` de React Native.
- Ambos: valores de duración y easing centralizados en `shared/theme.js` (`varDuracionRapida`, `varDuracionMedia`, `varEasingSuave`).

## Catálogo de animaciones

| Elemento                         | Animación                                                                  | Duración | Plataforma |
| -------------------------------- | -------------------------------------------------------------------------- | -------- | ---------- |
| Botones (hover / presión)        | Hover: elevación sutil y oscurece 6%. Presión móvil: escala 0.97           | 150ms    | Web / Móvil |
| Tarjeta de ramo                  | Hover: sube 4px con sombra suave; la foto hace zoom 1.04                   | 250ms    | Web        |
| Agregar al carrito               | Miniatura del ramo "vuela" al ícono del carrito, que hace un pequeño pulso | 450ms    | Web / Móvil |
| Cambio de pantalla (móvil)       | Push/pop con deslizamiento lateral y fundido                               | 300ms    | Móvil      |
| Modales y drawers                | Modal: fundido + escala 0.96→1. Drawer: desliza desde la derecha           | 250ms    | Web        |
| Formulario a pantalla completa   | Sube desde abajo                                                           | 300ms    | Móvil      |
| FAB "Nuevo pedido"               | Aparece con escala 0→1; al presionar rota 90° y se transforma en "X"       | 250ms    | Móvil      |
| Línea de tiempo del pedido       | La línea entre estados crece de izquierda a derecha (o de arriba abajo) al cambiar de estado; el ícono del nuevo estado hace pulso | 500ms | Web / Móvil |
| Confirmación de pedido           | Lluvia suave de pétalos (12–16 elementos) sobre la pantalla de confirmación | 1200ms  | Web / Móvil |
| Entrega completada               | El ícono de flor "florece" (hojas y pétalos se abren) junto a la foto de confirmación | 800ms | Web / Móvil |
| Campana de notificaciones        | Balanceo corto al llegar una notificación nueva; el contador aparece con escala | 400ms | Web / Móvil |
| Carga de listas y catálogo       | Skeletons con brillo que recorre la tarjeta de izquierda a derecha         | 1200ms en bucle | Web / Móvil |
| Pull-to-refresh                  | Flor que gira mientras carga                                               | Hasta terminar la carga | Móvil |
| Alerta de stock bajo             | Indicador con pulso suave de opacidad, máximo 3 repeticiones               | 1000ms   | Web / Móvil |
| Estrellas de reseña              | Al seleccionar, las estrellas se llenan en cascada                         | 80ms por estrella | Web / Móvil |
| Cambio de estado (swipe, admin)  | La tarjeta se desliza hacia fuera y la siguiente sube a ocupar su lugar    | 300ms    | Móvil      |
| Mensajes de éxito / error        | Aparecen desde arriba con fundido y se ocultan solos a los 3 segundos      | 250ms    | Web / Móvil |

## Fondo decorativo

- Las ilustraciones de hojas y pétalos de zonas vacías pueden tener un movimiento muy lento (balanceo de 6–8 segundos), con opacidad máxima de 12%.
- Se desactivan en dispositivos con reducción de movimiento y en la tabla de reportes.

## Implementación web actual

- Al cambiar de apartado, la vista entra con un desplazamiento vertical leve y fundido (`view-enter`, 260ms).
- Las tarjetas de métricas, pedidos, catálogo e inventario aparecen escalonadas (`card-enter`, con retrasos de 45ms entre elementos).
- Si está activo `prefers-reduced-motion: reduce`, estas animaciones se omiten.