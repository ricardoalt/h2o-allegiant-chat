# UI/UX Design Plan — H2O Allegiant

Plan ejecutable para llevar el shell del chat de "shadcn template genérico" a una identidad propia, brand-dominant, manteniendo la base white-label.

---

## 1. Contexto del producto

SecondstreamAI se está rebrandeando como **H2O Allegiant**. La aplicación sigue siendo un white-label chat shell para distintas verticales (agua, legal, healthcare, etc.) — lo que cambia entre clientes es marca + agente interno; la UX queda idéntica.

**Aclaración white-label**: la primera instancia ES H2O Allegiant. El sistema de branding configurable se construye en otra fase; por ahora hardcodeamos H2O Allegiant pero dejamos los seams listos (tokens en `:root`, logo via componente) para reemplazar más adelante.

---

## 2. Identidad de marca — H2O Allegiant

### Logo
- Asset: PNG/SVG con "H2O" en cian-azul gradiente + "Allegiant" en blanco, sobre fondo navy oscuro.
- Logo trae background navy horneado — para usar transparente en cards claras/oscuras necesitamos versión sin fondo o tratamiento adaptativo.
- Símbolo: gota de agua con patrón estilo circuito.

### Colores (extraídos del PNG con ImageMagick, confirmados)

Anchor hex values:
| Hex       | Rol                                  | Origen en el logo            |
|-----------|--------------------------------------|------------------------------|
| `#002953` | Navy dominante (surface dark)        | Fondo del logo               |
| `#003E84` | Deep blue                            | Tip derecho del "H2O"        |
| `#005EA3` | Mid blue                             | Gradiente medio              |
| `#0070E2` | Bright blue (acción primaria)        | Cuerpo "H2O" más vivo        |
| `#0099E6` | Cyan accent (glow, atmósfera)        | Extremo izq "H" (bright)     |
| `#FFFFFF` | Texto sobre navy                     | "Allegiant"                  |

Escala OKLCH derivada (registrada en `:root`):
```
--brand-50:  oklch(0.97 0.025 248)
--brand-100: oklch(0.93 0.05 248)
--brand-200: oklch(0.86 0.09 245)
--brand-300: oklch(0.78 0.12 240)
--brand-400: oklch(0.681 0.155 234)  /* #0099E6 cyan */
--brand-500: oklch(0.578 0.205 258)  /* #0070E2 bright blue → PRIMARY */
--brand-600: oklch(0.485 0.152 250)  /* #005EA3 mid */
--brand-700: oklch(0.358 0.143 257)  /* #003E84 deep */
--brand-800: oklch(0.282 0.085 252)  /* #002953 navy */
--brand-900: oklch(0.22 0.06 252)
```

Aliases semánticos:
- `--brand-primary` → `var(--brand-500)` (buttons, links, focus)
- `--brand-cyan` → `var(--brand-400)` (glows, accents)
- `--brand-navy` → `var(--brand-800)` (dominant dark surface)

### Dirección estética: **Soft Confident**
Inspiración: Anthropic Claude, Notion AI, Arc Browser.

Principios:
- Brand-dominant: el azul/cian de H2O Allegiant es el ancla cromática, no un accent tímido.
- Corners suaves: `--radius` sube a `0.75rem` mínimo.
- Atmósferas: gradientes radiales sutiles + grain noise + glow brand-tinted detrás de surfaces clave.
- Curvas sobre bordes duros: shadows con brand-glow, no harsh rectangles.
- Tipografía: Geist Variable se mantiene para body. Display se evalúa después (Geist alcanza si simplicidad gana; si quisiéramos más distintivo, Söhne o Fraunces).
- Copy: confiado pero approachable; nada de "What can I help with?" genérico.

---

## 3. Audit findings (resumen ejecutivo)

Auditoría realizada con `web-design-guidelines`, `frontend-design`, `ai-elements`. Detalle completo en el log de conversación.

### Bugs críticos
- `src/styles.css:64-65` y `:136-137` → `--destructive-foreground` igual a `--destructive` (texto invisible sobre destructivo)
- `src/styles.css:15-22` → `body { font-family: system stack }` fuera de `@layer base` pisa al `@apply font-sans`; Geist importada pero probablemente NO aplicada
- `app/layout.tsx:1` → `@aws-amplify/ui-react/styles.css` global; cientos de kB cargados en rutas que no usan Amplify

### Theme — incoherente
- Tema base es shadcn default (stone/warm gray) prácticamente sin tocar
- `--primary` es near-black/near-white (contraste puro), no la marca
- `--sidebar-primary` en dark mode es indigo random, distinto al brand
- `--ring` gris desaturado: focus rings de toda la app sin brand
- 3 "primaries" peleando: warm gray + indigo + blue brand
- Chart colors (5) random sin relación al brand
- Sin `--success`, `--warning`, `--info`
- `src/components/app-sidebar.tsx:239` → `bg-orange-500` hardcoded en avatar

### Animaciones
- Cero ocurrencias de `prefers-reduced-motion` en el repo
- `transition-all` en button, badge, sidebar, attachments (anti-pattern)
- Stagger por message acumulativo sin límite

### Taste / carácter
- Geist Variable es el font más genérico del momento (todos los templates shadcn)
- `components.json` usa `baseColor: "stone"` (el más tímido)
- Empty state copy "What can I help with?" copia literal de ai-sdk demos
- Tool calls (webSearch, working-memory, discovery) renderizan como divs planos con shimmer — momentos de marca desaprovechados
- User message bubbles con `bg-secondary` gris muerto
- Chat sin atmósfera (el login sí tiene, el chat no)

### Componentes ai-elements no usados (registry oficial)
- `suggestion` → empty state con prompt cards
- `tool` → renderiza tool calls oficialmente
- `chain-of-thought` → reasoning rico con steps/nesting
- `artifact` → para PDFs/documentos generados (clave para vertical agua)
- `task` + `plan` → para output del discovery agent
- `inline-citation` → citas inline en respuestas largas
- `confirmation` → confirmaciones in-chat para acciones destructivas
- `canvas` / `panel` → split-view PDF + conversación
- `persona` → branding del agente dentro del chat

### Otras
- Sin `<meta name="theme-color">`
- Sin skip-to-content link
- Sin `color-scheme: dark` en `<html>`
- Ellipsis ASCII `...` en lugar de `…` (3 strings: settings-dialog:165, chat-interface:281, chat-interface:359)
- Sin `text-balance` / `text-pretty` en headings
- Sin `tabular-nums` en timestamps
- `displayName.slice(0, 2)` para initials — no respeta separadores
- MessageActions con `opacity-0 group-hover:opacity-100` invisibles en touch

---

## 4. Plan de ejecución por fases

Estimación total: ~10h. Cada fase es independiente y entregable.

### P0 — Bugs técnicos (~1h)
1. `--destructive-foreground` near-white en ambos modos
2. Quitar `font-family: -apple-system,...` suelto del body sin layer; dejar `@layer base body { @apply font-sans }`
3. Mover `import "@aws-amplify/ui-react/styles.css"` de `app/layout.tsx` a `app/login/layout.tsx` (nuevo route segment)

### P1 — Brand-dominant theme (~2h)
4. Definir `--brand-navy`, `--brand-cyan`, `--brand-blue`, `--brand-blue-deep` en `:root` + registrar en `@theme inline`
5. `--primary` light → `var(--brand-blue)`, dark → `var(--brand-cyan)` (más bright para contraste en dark)
6. `--ring` → brand
7. `--sidebar-primary` → brand (elimino indigo)
8. `--radius` → `0.75rem`
9. Avatar sidebar: `bg-orange-500` → `bg-brand-blue` (o función deterministic-color-by-user, opcional)
10. Chart colors derivados del brand (5 variantes coherentes)
11. `color-scheme: light dark` sobre `<html>` via theme provider
12. Renombrar tokens existentes `--brand-50..700` (legacy de SecondStream blue) → consolidar bajo la nueva paleta H2O Allegiant

### P-DESIGN — Atmósfera Soft Confident en todo el app (~3h)
13. Backdrop atmosférico en chat surface (radial gradient brand muy sutil + grain noise restrained)
14. Message bubbles distintivas:
    - User: `bg-brand-blue/8` con sombra brand-tinted sutil
    - Asymmetric border-radius en esquina inferior-derecha (signature shape)
15. Tool calls con personalidad — los 3 inline en `chat-interface.tsx:258-310`:
    - `tool-webSearch`: pill con icon globe + shimmer brand-tinted
    - `tool-updateWorkingMemory`: ícono distintivo + transition
    - `tool-generateDiscoveryReportBundle`: card con brand-tint + animación de assembly
16. Empty state rediseñado:
    - Headline editorial-soft con `text-balance`
    - Copy específico H2O Allegiant (TBD con usuario)
    - Sub-headline con tagline
    - 3 suggestion cards via `@ai-elements/suggestion`
17. Sidebar refinada:
    - Separator hairlines `border-brand-blue/10`
    - Hover states con tint brand
    - Active thread con left-border brand
18. Curly ellipsis `…` en los 3 strings (settings-dialog:165, chat-interface:281, chat-interface:359)

### P2 — Animaciones responsables (~1h)
19. Regla global `prefers-reduced-motion` en `styles.css`
20. Reemplazar `transition-all` por listas específicas en button.tsx, badge.tsx, sidebar.tsx, attachments.tsx
21. Stagger limitado en chat: `Math.min(index, 8) * 0.04`

### P3 — ai-elements oficiales (~2h)
22. Instalar `@ai-elements/suggestion` → usar en empty state (3 prompts según vertical)
23. Instalar `@ai-elements/tool` → reemplazar bloque inline tool-webSearch/working-memory/discovery
24. (Opcional) Instalar `@ai-elements/chain-of-thought` para reasoning más rico
25. (Opcional, vertical agua) Instalar `@ai-elements/artifact` para PDFs

### P4 — Detalles que profesionalizan (~1h)
26. `<meta name="theme-color">` dinámico matching `--background`
27. Skip-to-content link
28. Initials inteligentes (split por `.`, `@`, ` `)
29. `text-balance` en H1/H2 (chat-interface, settings, login)
30. `tabular-nums` en timestamps del sidebar (`groupByDate` labels)
31. MessageActions visibles en touch (media query `(hover: none)`)
32. Logo H2O Allegiant: refactor `OpenChatLogo` para soportar el asset nuevo (con o sin fondo navy según contexto)

---

## 5. Decisiones tomadas

- **Dirección estética**: Soft Confident (Claude / Notion AI / Arc).
- **Brand**: cambio de SecondStream → H2O Allegiant. White-label sigue en backlog.
- **No tocar lógica Cognito/Amplify**: todas las mejoras son CSS/composición.
- **Brand tokens viven en `src/styles.css :root`** y se exponen vía `@theme inline` (patrón Tailwind v4 + shadcn).

---

## 6. Decisiones pendientes / preguntas abiertas

1. **Hex exactos de la paleta H2O Allegiant** — confirmar valores estimados o pasar specs oficiales.
2. **Copy del empty state** — qué prompts/sugerencias mostrar (asumiendo vertical agua para esta instancia).
3. **Tipografía display** — mantener Geist o pasar a Söhne/otra distintiva.
4. **Logo asset**: ¿hay versión transparente sin fondo navy? Si no, ¿usamos el navy como background del logo container o forzamos transparencia programática?
5. **Avatar deterministic color**: ¿hash por email para color único por usuario, o todos en brand?
6. **White-label config layer**: ¿cuándo lo armamos? Lo más limpio es ANTES de seguir hardcodeando "H2O Allegiant" en lugares nuevos.

---

## 7. Orden de ejecución recomendado

1. Confirmar hex de la paleta
2. P0 + P1 (~3h) — shift de identidad inmediato
3. P-DESIGN (~3h) — donde se ve el wow factor
4. P2 + P4 (~2h) — pulido + a11y
5. P3 (~2h) — componentes oficiales, requiere alineación de copy/verticals

---

## 8. Garantías

- Cero cambios en `amplify/auth/resource.ts`
- Cero cambios en flow de Cognito
- Cero cambios en `useChat` / chat transport / API handlers
- Cero rompimientos de tests existentes
- Cada fase verificable con `npx tsc --noEmit` + `npx vitest run`
