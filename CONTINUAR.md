# Continuar: concesionario Flyline con autos en 3D

Resumen para retomar el trabajo en otra sesión, con las skills **img2threejs** y
**gsap-*** cargadas. Repo `BelWabeDesign/web`, rama `claude/prepare-3d-mageih`.

## Qué se pidió

1. «En base a este Porsche genera un modelo 3D, y genera una página para un concesionario,
   con este y más autos». Se entregaron tres fotos de un **Porsche 911 GT3 RS (992)** en rosa
   metalizado (Frozen Berry): de perfil, en tres cuartos delantero y de frente.
2. Después: «Utiliza estas skills para implementar la página, rehaz el modelo de los autos,
   hazlo usando el Porsche que te envié originalmente en 3D»: **img2threejs**, gsap-core,
   gsap-timeline, gsap-scrolltrigger, gsap-react, gsap-plugins, gsap-performance, gsap-utils
   y gsap-frameworks.

Decisiones ya tomadas por el cliente:

- **Solo el GT3 RS** se rehace a partir de las fotos. El 911 Carrera S, el 718 Cayman GT4 RS y
  el Taycan Turbo S mantienen su forma propia, pero hay que mejorarlos.
- Se usan **las fotos que hay** (son muy pequeñas: el auto ocupa ~160×50 px de perfil).
- gsap-react no aplica: la página es HTML + JavaScript sin React.

## Estado actual

Proyecto Vite con dos páginas: `index.html` (Torno, tienda de cerámica, terminada) y
`concesionario.html` (**Flyline**, el concesionario, lo que hay que continuar).

```bash
npm install
npm run dev            # http://localhost:5173/concesionario.html
npm run cars           # regenera los .glb de los autos (scripts/build-cars.mjs)
npm run car-renders    # regenera las imágenes del stock desde los .glb
npm run build          # dist/ con las dos páginas
npm run build:single   # dist-single/flyline.html: todo en un archivo, se abre con doble clic
```

### Archivos de Flyline

| Archivo | Qué es |
| --- | --- |
| `concesionario.html` | Marcado de la página. Los comentarios `<!--stock-->`, `<!--pestanas-->`, `<!--leyenda-->`, `<!--perfiles-->`, `<!--tabla-->` y `<!--opciones-auto-->` los rellena `vite.config.js` con los datos de `autos.js`. |
| `src/concesionario/autos.js` | **Fuente única**: ficha comercial (precio, km, color, potencia, 0–100, velocidad, motor, caja, medidas reales) y geometría de cada auto. También `dolares()`, `kms()`, `numero()` y `cuota()`. |
| `src/concesionario/visor.js` | Visor 3D (`CarViewer`): carga `public/models/autos/<id>.glb`, aplica los materiales por nombre, estudio de luz propio, sombra, giro con arrastre o teclado, revelado tipo escáner (`reveal()`), resolución adaptativa y pausa fuera de pantalla. |
| `src/concesionario/main.js` | Menú, ficha del showroom, pestañas con teclado, calculadora de cuota, gráfico de siluetas, formulario de cita y animaciones GSAP. |
| `src/concesionario/flyline.css` | Tokens, maquetación y estados. |
| `scripts/build-cars.mjs` | Generador actual de los autos (campo de distancia a partir de las vistas, surface nets, zonas de material, simplificación con meshoptimizer, ruedas, faros, espejos y alerón). |
| `scripts/render-cars.mjs` + `tools/render-car.html` | Renders del stock con el mismo visor, en Chromium (Playwright). |
| `scripts/build-single.mjs` | Versiones de un solo archivo de las dos páginas. |
| `public/images/autos/gt3rs-*.webp` | Las tres fotos del cliente, recortadas. |

### Secciones de la página

1. **Portada**: titular «Porsche seleccionados», texto, botón «Ver los cuatro autos» y el GT3 RS en 3D a todo el ancho, con ficha (nombre, año, km, precio).
2. **Stock**: «Cuatro autos en stock», una fila por auto (render, datos, precio, «Ver en 3D», «Agendar visita»), alternando el lado de la imagen.
3. **Showroom 3D** (fondo asfalto): «Míralo por todos lados», cuatro pestañas, visor grande, ficha con datos, las fotos de la unidad (solo GT3 RS) y calculadora de cuota (enganche del 20 al 60 %, plazo de 24 a 60 meses, tasa de ejemplo del 9,9 %).
4. **Comparar**: «Cuatro perfiles, a escala», las siluetas laterales superpuestas, alineadas en el eje delantero, con leyenda, tooltip y tabla de datos de fábrica.
5. **Garantía**: «Así llega cada auto», cuatro pasos.
6. **Visita**: «Agenda una visita», formulario que valida y abre un correo con la solicitud.
7. **Pie**: la marca «Flyline» a todo el ancho y el aviso de marcas («Porsche, 911, Cayman y Taycan son marcas de Porsche AG…»).

### Sistema visual (mantenerlo)

- Tipografía: **Archivo Variable** (`@fontsource-variable/archivo/wdth.css`). Titulares con `font-stretch: 125%`, peso 760 e interletrado -0.035em; texto al 100 %.
- Colores: fondo `#eceae6`, superficies `#dfddd8` y `#d2d0ca`, tinta `#141416`, tinta secundaria `#55555c`, acento rosa Frozen Berry `#9b4762` (sobre oscuro `#d79aac`) y asfalto `#18191b` para el showroom y el pie.
- Reglas: botones de esquinas rectas; sin degradados, sin sombras en reposo (solo en lo que flota), sin etiquetas pequeñas encima de los titulares, sin monoespaciada, sin numeración 01/02; titulares de dos líneas como máximo en 1440, 768 y 390 px.
- Números con punto de miles y coma decimal (US$ 365.000, 4,57 m): usar `numero()` / `dolares()`.

## Lo que falta

### 1. Rehacer el GT3 RS con img2threejs

- Entrada: las tres fotos del cliente (los PNG originales, o `public/images/autos/gt3rs-*.webp`).
- Salida: `public/models/autos/gt3rs.glb`, que reemplaza al generado por `build-cars.mjs`.
- Para que el visor siga funcionando sin cambios:
  - Unidades en metros; **+X hacia el frente**, Y hacia arriba, Z a lo ancho; ruedas apoyadas en y = 0 y centrado en x = 0, z = 0.
  - Medidas reales: largo 4.572 mm, ancho 1.900, alto 1.322, entre ejes 2.457.
  - Nombres de material: `pintura`, `cristal`, `negro`, `piloto`, `faro`, `luz`, `neumatico`, `llanta`, `disco`, `pinza`. Si salen otros, adaptar `makeMaterial()` en `visor.js`.
- Detalles que se ven en las fotos: pintura rosa metalizada; faros redondos sobre los guardabarros delanteros; capó hundido con dos tomas negras; tomas sobre los guardabarros y detrás de las ruedas delanteras; toma vertical negra detrás de la puerta; llantas negras multirradio con tuerca central y pinzas rojas; splitter delantero negro; alerón trasero de cuello de cisne con la superficie pintada y soportes y derivas negros; espejos negros; gran toma central negra en el paragolpes.
- Si el modelo pesa más de ~1 MB, comprimirlo (meshopt, como el resto; el visor ya trae el decodificador).

### 2. Mejorar los otros tres autos

Siguen saliendo de `scripts/build-cars.mjs` con su geometría en `autos.js`. Se ven genéricos: silueta poco fiel, laterales planos y tomas que parecen pegatinas. Mejorarlos con img2threejs a partir de referencias de cada modelo, o afinando sus perfiles. Conservar los nombres de material.

### 3. Animación con las skills de GSAP

Animaciones actuales, todas en `src/concesionario/main.js` salvo el escáner:

- Portada: titular por líneas con SplitText y entrada escalonada del texto, los botones, la ficha y la barra.
- Secciones: `ScrollTrigger.batch` que sube y aparece cada titular, texto y bloque.
- Stock: la imagen de cada auto entra desde su lado y luego el texto.
- Comparar: las siluetas se dibujan con `strokeDashoffset`.
- Pie: la marca entra letra a letra.
- 3D (`visor.js`): revelado con plano de recorte que va de la trompa a la cola, giro lento, inercia al arrastrar.
- Todo dentro de `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; con movimiento reducido la página queda quieta y completa.

Pendiente: revisar con gsap-core, timeline, scrolltrigger, plugins, performance, utils y frameworks. Ordenar en timelines con etiquetas, añadir limpieza (`gsap.context` / `revert`), `ScrollTrigger.refresh` tras cargar los modelos, rendimiento (sin animar layout, `will-change` solo durante la animación) y valorar una escena ligada al scroll en el showroom. Nada puede quedar oculto si el JavaScript falla.

### 4. Comprobar antes de entregar

- `npm run build` sin errores y capturas a 1440, 768 y 390 px: sin desbordamiento horizontal, titulares de dos líneas como máximo, nada vacío ni oculto.
- Pestañas y controles usables con el teclado; el 3D con imagen de respaldo si no hay WebGL.
- `npm run car-renders` y `npm run build:single`; abrir `dist-single/flyline.html` con doble clic y revisar que cargan los dos visores sin errores.

## Contenido de ejemplo (cambiar antes de publicar)

El nombre Flyline, kilometrajes, precios en US$, equipamiento, horario, garantía, la tasa del
9,9 % y el correo `citas@flyline.example` son inventados. Los datos técnicos son los de
fábrica de cada modelo y hay que confirmarlos con cada unidad. No se usan logotipos de Porsche.

## Texto para empezar la sesión nueva

> Lee `CONTINUAR.md` en la rama `claude/prepare-3d-mageih`. Usa img2threejs para rehacer el
> Porsche 911 GT3 RS a partir de las tres fotos (`public/images/autos/gt3rs-*.webp`) y guárdalo
> en `public/models/autos/gt3rs.glb`, con las medidas y los nombres de material indicados.
> Mejora el Carrera S, el Cayman GT4 RS y el Taycan. Revisa las animaciones de
> `src/concesionario/main.js` y `visor.js` con las skills de GSAP. Mantén el sistema visual,
> regenera los renders y el archivo único, y comprueba la página en 1440, 768 y 390 px.
