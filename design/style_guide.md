# Style Guide

## Visual System

- **Base Style**: Glassmorphism con light/dark mode — tarjetas translúcidas con `backdrop-blur`, bordes sutiles, sobre un fondo crema cálido (paleta real de marca, ver DEC-12).
- **Typography**: Sans-serif moderna (ej. Inter o similar), escala 12/14/16/20/24/32px, pesos regular/medium/semibold.
- **Colors**: Paleta extraída directamente de "Nuestros servicios Oopss Nails.pdf" (portada + encabezados de categoría), no inventada — ver DEC-12. Modo claro: fondo crema `#F7F2F0`, primario taupe/mocha `#917E72`, acento tostado `#C2AB9D`. Modo oscuro: fondo café oscuro cálido `#241B1E`, primario tostado claro `#D9BFAE`, acento dorado `#D2A56B`. Semánticos: éxito verde salvia, advertencia ámbar, error terracota — ambos con suficiente contraste en los dos modos.
- **Spacing**: Escala de 4px (4/8/12/16/24/32/48).
- **Border Radius**: Generoso (12–20px) para reforzar el look glassmorphism suave.

## Component Patterns

- **Cards**: `backdrop-filter: blur`, fondo semitransparente, borde 1px translúcido, sombra suave difusa.
- **Buttons**: Primario (relleno acento), secundario (borde/glass), destructivo (rojo) — todos con estado hover/disabled/loading claros.
- **Forms**: Labels arriba del input, validación inline debajo del campo, estados de error con borde rojo + mensaje.
- **Tables**: Filas con hover sutil, paginación simple, indicadores de orden en headers clicables (usado en `/admin/citas`, `/admin/servicios`).
- **Navigation**: Sidebar fijo en `/admin/*` con estado activo resaltado; el sitio público no necesita navegación compleja (chat es la pantalla principal).

## Responsive Breakpoints

- Mobile: < 640px (prioridad, ya que muchas clientas usarán el chat desde el móvil)
- Tablet: 640–1024px
- Desktop: > 1024px

## Accessibility

- Minimum contrast ratio: 4.5:1 (AA) — verificar especialmente sobre fondos glassmorphism translúcidos, donde el contraste puede degradarse.
- Focus indicators on all interactive elements.
- Keyboard navigation support (crítico en el panel admin — formularios y tablas).

(Populated during planning with /init-project)
