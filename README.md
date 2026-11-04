# Torno · tienda de cerámica en 3D

Página de tienda (e-commerce) con modelos 3D reales de cada pieza, configurador de
esmalte y tamaño, cesta y animaciones. Contenido de ejemplo: **Torno**, un taller
ficticio de cerámica torneada en Manises (València). Diseño y desarrollo: BelWabe Design.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ (estático, se puede servir desde cualquier carpeta)
npm run preview
npm run build:single   # dist-single/torno.html: todo en un solo archivo (~3 MB), se abre con doble clic
```

## Qué hay en la página

| Sección | Qué hace |
| --- | --- |
| Portada | El Jarrón Albufera se **forma girando su perfil**, como en el torno (corte angular en el shader), y luego sigue girando. Se arrastra con el dedo, el ratón o las flechas. |
| Piezas | Las seis piezas con precio, medidas, esmalte y botón de compra. Las imágenes son renders de los propios modelos 3D. |
| Esmaltes | Configurador 3D: pieza, seis esmaltes y tres tamaños. El precio se recalcula y la pieza cambia de color y de escala en vivo. |
| La hornada | Escena ligada al scroll: el albarelo pasa de barro húmedo a bizcocho, esmalte crudo, horno a 1.280 °C y pieza terminada. |
| Manises | Piezas reales de museo (Met y Cleveland, CC0) de las que salen los perfiles y esmaltes. |
| Envíos | Cifras de envío y preguntas frecuentes. |
| Cesta | Diálogo lateral, cantidades, envío gratis desde 80 €, pedido por correo (`mailto:`). Se guarda en `localStorage`. |

Sin WebGL o sin JavaScript la página se lee entera: cada visor tiene su imagen de respaldo
y las fichas están escritas en el HTML al compilar.

## Flujo 3D (`npm run prepare-3d`)

1. **Perfiles → modelos** (`npm run models`, `scripts/build-models.mjs`).
   Cada pieza de `src/data/catalog.js` se define por su media silueta en centímetros.
   El script la muestrea con una spline, le da grosor de pared, redondea el labio, la
   gira 360° y escribe `public/models/<id>.glb` con dos materiales (`esmalte` y `pie`,
   el anillo de barro sin esmaltar). Después cuantiza y comprime con meshopt
   (glTF Transform): 80–200 KB por pieza.
2. **Modelos → imágenes** (`npm run renders`, `scripts/render-products.mjs`).
   Abre `tools/render.html` en Chromium (Playwright) con el mismo visor de la página
   y guarda `public/renders/<id>.webp` (1000×1250, fondo transparente) y `<id>-sm.webp`.

**Para usar modelos escaneados o modelados de verdad:** sustituye `public/models/<id>.glb`
(en metros, base en y = 0, eje de giro en Y). Si los materiales se llaman `esmalte` y
`pie`, el configurador seguirá cambiando el esmalte. Después ejecuta `npm run renders`.

El visor (`src/three/viewer.js`) carga three.js aparte del resto de la página, usa
luz de estudio (`RoomEnvironment`) con sombra, limita la densidad de píxeles a 2, baja
la resolución si el equipo no llega a ~30 fps y deja de dibujar fuera de pantalla.

## Estructura

```
index.html                 página (las fichas se insertan desde el catálogo en vite.config.js)
src/data/catalog.js        piezas, perfiles, esmaltes, tamaños y precios (fuente única)
src/three/viewer.js        visor 3D: carga .glb, esmaltes, anillos del torno, giro, corte
src/main.js                configurador, visores y la semana de la pieza
src/cart.js                cesta y pedido por correo
src/motion.js              GSAP + ScrollTrigger + SplitText; respeta «reducir movimiento»
src/styles.css             tokens, maquetación y estados
scripts/                   generación de modelos y renders
tools/render.html          página de render para el script (no se publica)
public/models, renders     modelos .glb y sus imágenes
public/images/manises      fotografías de museo (CC0)
```

## Antes de publicar

- **Contenido de ejemplo:** la marca Torno, los nombres de las piezas, precios, medidas,
  plazos de envío, horario del taller y los correos `hola@torno.example` y
  `pedidos@torno.example` son inventados. Sustitúyelos por los reales.
- **Pago:** el botón de la cesta abre un correo con el pedido. Para cobrar con tarjeta hay
  que conectar una pasarela (Stripe, Redsys…) en `checkoutHref()` de `src/cart.js`.
- **Imágenes de museo:** se usan como contexto histórico, nunca como producto de la
  tienda. Los créditos están en el pie de la página:
  - Plato de reflejo dorado (anverso y perfil), Valencia (probablemente Manises), segunda
    mitad del s. XV. The Metropolitan Museum of Art, Robert Lehman Collection, 1975. CC0.
    https://www.metmuseum.org/art/collection/search/460993
  - Albarelo, Manises, h. 1400–1420. The Cleveland Museum of Art, Purchase from the
    J. H. Wade Fund, 1953.287. CC0. https://clevelandart.org/art/1953.287
  - Albarelo con dos conejos, Paterna, s. XIV. The Cleveland Museum of Art, 1943.276. CC0.
    https://clevelandart.org/art/1943.276
  - Albarelo con letras pseudocúficas, Paterna, s. XIV. The Cleveland Museum of Art,
    1945.28. CC0. https://clevelandart.org/art/1945.28
