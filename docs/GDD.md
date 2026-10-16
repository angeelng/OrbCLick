# Orbclick — Documento de diseño (GDD)

Oct 12, 2026 · @Ángel Núñez Guerrero

## Visión y pilares

Orbclick es un juego *idle/clicker* de navegador en pixel art donde capturas criaturas que trabajan por ti, combaten a tu lado y desbloquean nuevas zonas. Nombre provisional.

**Pilares**

1. **Cada clic se siente bien**: feedback inmediato (números flotantes, partículas, sonido).
2. **Tus criaturas son tu motor**: la producción viene de quién capturas y dónde lo pones a trabajar.
3. **Decisiones con coste**: una criatura combatiendo no trabaja; un orbe caro no se gasta en una común.
4. **Aventura limpia**: tono aventurero con interfaz sobria, legible y sin saturación.

**Restricciones**

- Juego de navegador, sin motor gráfico: TypeScript, Canvas 2D y DOM.
- 2D en pixel art; el MVP usa *placeholders* generados por código.
- Criaturas, nombres y objetos 100 % originales (nada de marcas de Pokémon o Palworld).

## Bucle principal y recursos

El jugador clica el objeto central de la zona, gana monedas y XP, compra orbes y mejoras, captura criaturas y las pone a trabajar o a combatir; la producción crece y desbloquea la siguiente zona.

1. **Clicar** el objeto central → monedas + XP (+ botín ocasional).
2. **Comprar** orbes, bayas y mejoras en la tienda.
3. **Capturar** criaturas salvajes que aparecen en la zona.
4. **Asignar** cada criatura a un puesto del Rancho (producción pasiva) o al equipo de combate.
5. **Combatir** salvajes raras y al jefe de zona.
6. **Subir de nivel** → nuevas criaturas, objetos y zonas.

| Recurso | Cómo se obtiene | Para qué sirve |
| --- | --- | --- |
| Monedas | Clics y producción del Rancho | Tienda y mejoras |
| XP de entrenador | Clics, capturas y combates | Subir de nivel y desbloquear contenido |
| Orbes de captura | Tienda, botín, puesto de Artesanía | Capturar criaturas |
| Bayas | Tienda, puesto de Cultivo, botín | Alimentar criaturas (bonus de producción) y curar en combate |
| Polvo estelar | Prestigio (post-MVP) | Mejoras permanentes |

## Zonas del MVP

El MVP tiene tres zonas; cada una tiene su objeto clicable, su tipo favorecido, su roster y un jefe que abre la siguiente.

| Zona | Objeto clicable | Desbloqueo | Tipo favorecido (+25 %) | Jefe |
| --- | --- | --- | --- | --- |
| Pradera | Árbol de bayas gigante | Inicio | Planta | Cornavid (Planta) |
| Cueva | Veta de cristal | Nivel 5 + jefe de Pradera | Roca | Geodrón (Roca) |
| Lago | Manantial burbujeante | Nivel 10 + jefe de Cueva | Agua | Marealis (Agua) |

- Cada zona tiene su propio estado: objeto clicable, criaturas salvajes que aparecen y pool de botín.
- El jugador cambia de zona libremente una vez desbloqueada; el Rancho es global.
- El bonus de tipo se aplica a las criaturas que trabajan mientras esa zona está activa.

## Criaturas

El MVP tiene 12 criaturas capturables y 3 jefes, repartidos en 6 de los 8 tipos; Luz y Sombra quedan para después del MVP.

**Ficha de cada especie (datos)**

- `id`, nombre, tipo, rareza, zonas donde aparece.
- Estadísticas base de combate: PV, ATQ, DEF, VEL.
- Aptitudes de trabajo (1–3): Recolectar, Minar, Cultivar, Explorar, Artesanía, Cuidar.
- Habilidad pasiva (de Rancho) y habilidad activa (de combate).

**Ficha de cada ejemplar capturado (partida)**

- Nivel y XP, rasgo aleatorio, variocolor sí/no, puesto o equipo asignado, saciedad.
- Rasgos posibles: Laboriosa (+10 % producción), Perezosa (−5 %), Valiente (+10 % ATQ), Robusta (+10 % PV), Glotona (gasta el doble de bayas, +15 % producción), Afortunada (+5 % botín).

**Rarezas**: Común · Poco común · Rara · Épica · Legendaria (solo jefes en el MVP).

**Tabla de tipos (×1,5 de daño al tipo débil, ×0,67 al resistente)**

| Atacante | Fuerte contra | Débil contra |
| --- | --- | --- |
| Planta | Agua, Roca | Fuego, Aire |
| Fuego | Planta | Agua, Roca |
| Agua | Fuego, Roca | Planta, Eléctrico |
| Roca | Fuego, Aire, Eléctrico | Agua, Planta |
| Eléctrico | Agua, Aire | Roca, Planta |
| Aire | Planta | Roca, Eléctrico |

**Roster del MVP**

| Criatura | Tipo | Rareza | Zona | Aptitudes | Pasiva (Rancho) | Activa (combate) |
| --- | --- | --- | --- | --- | --- | --- |
| Brotillo | Planta | Común | Pradera | Cultivar 2 | +5 % bayas por cada Brotillo | Látigo de hoja |
| Pelusín | Aire | Común | Pradera | Recolectar 1, Explorar 1 | +10 % aparición de salvajes | Ráfaga |
| Ascuín | Fuego | Poco común | Pradera | Minar 1 | 3 % de clics dan ×5 | Chispazo ardiente |
| Chispín | Eléctrico | Rara | Pradera | Recolectar 2 | CPS ×2 durante 10 s cada 60 s | Descarga |
| Pedrusco | Roca | Común | Cueva | Minar 2 | +1 moneda plana por clic | Placaje rocoso |
| Musgolito | Planta | Común | Cueva | Cultivar 1, Cuidar 1 | Las bayas sacian un 20 % más | Esporas (adormece) |
| Brasacol | Fuego | Poco común | Cueva | Minar 2, Artesanía 1 | Orbes un 10 % más baratos | Llamarada |
| Cuarzín | Roca | Rara | Cueva | Minar 3 | +15 % monedas por clic en la Cueva | Escudo de cristal |
| Gotón | Agua | Común | Lago | Recolectar 1 | +10 % producción de las criaturas Planta | Burbuja |
| Ranaflor | Planta | Poco común | Lago | Cultivar 2, Recolectar 1 | +1 baya extra por cosecha | Drenaje (cura) |
| Anguilux | Eléctrico | Poco común | Lago | Recolectar 2, Explorar 1 | Las salvajes raras aparecen un 15 % más | Electroespiral |
| Nenúfrel | Agua | Rara | Lago | Cuidar 2, Artesanía 2 | 10 % de no gastar el orbe | Marea curativa |
| Cornavid | Planta | Legendaria | Jefe Pradera | Cultivar 3, Recolectar 2 | ×1,5 producción en la Pradera | Raíz ancestral |
| Geodrón | Roca | Legendaria | Jefe Cueva | Minar 3, Artesanía 2 | ×1,5 producción en la Cueva | Terremoto |
| Marealis | Agua | Legendaria | Jefe Lago | Recolectar 3, Cuidar 2 | ×1,5 producción en el Lago | Gran marea |

Los jefes se capturan tras derrotarlos (captura garantizada con Orbe lunar o superior). **Variocolor**: 1/500 en la aparición, paleta alternativa y producción ×2.

## Captura

Las criaturas salvajes aparecen en la zona activa; las comunes se debilitan a clics y las raras exigen combate antes de lanzar el orbe.

1. **Aparición**: cada 45–90 s (reducible con Explorar) aparece una salvaje del roster de la zona, elegida por peso de rareza. Se queda 20 s; si no la atiendes, huye.
2. **Debilitar**:
   - Común y poco común: cada clic sobre ella le quita PV (daño de clic del jugador).
   - Rara o superior: abre un combate con tu equipo (sección Combate).
3. **Lanzar orbe**: el jugador elige el orbe; se resuelve la probabilidad (fórmula en Balance). Si falla, la criatura tiene 50 % de huir.
4. **Resultado**: capturada → entra al Rancho con nivel 1, rasgo aleatorio y saciedad completa. Si el Rancho está lleno, va a la Reserva (no produce).

| Orbe | Multiplicador de captura | Precio base | Desbloqueo |
| --- | --- | --- | --- |
| Orbe básico | ×1 | 50 monedas | Inicio |
| Orbe de red | ×1,5 (×2 contra Agua) | 250 monedas | Nivel 4 |
| Orbe lunar | ×2,5 | 1.500 monedas | Nivel 9 |

El Orbe maestro (captura garantizada) queda fuera del MVP.

## Rancho y trabajo

El Rancho convierte criaturas en producción pasiva: cada una ocupa un puesto y rinde según su aptitud, nivel, rasgo y saciedad.

| Puesto | Aptitud que usa | Qué produce |
| --- | --- | --- |
| Campo de recolección | Recolectar | Clics automáticos por segundo (CPS) |
| Mina | Minar | Multiplicador de monedas por clic |
| Huerto | Cultivar | Bayas por minuto |
| Puesto de exploración | Explorar | Menos tiempo entre apariciones y más botín |
| Taller | Artesanía | Orbes básicos por minuto y descuentos |
| Guardería | Cuidar | XP pasiva para las criaturas del Rancho |

- **Plazas**: 4 al inicio, ampliables en la tienda hasta 16 en el MVP. La Reserva guarda el resto sin límite.
- **Saciedad** (0–100): baja 1 punto por minuto trabajando. Por encima de 50 rinde al 100 %, entre 1 y 50 rinde al 60 %, a 0 se detiene. Las bayas se reparten solas desde un comedero.
- **Nivel de criatura**: sube con XP de la Guardería y del combate; cada nivel da +5 % de producción y estadísticas.
- **Sinergias**: Agua + Planta en el Rancho → +15 % bayas; Fuego + Roca → +10 % minería; Eléctrico + Aire → +10 % CPS. Cada par cuenta una vez.
- **Visual**: las criaturas pasean y se animan en su puesto; al clicar una se abre su ficha.

## Combate y jefes de zona

El combate es automático y en tiempo real, con el jugador interviniendo a clics; dura entre 20 y 90 s.

- **Equipo**: hasta 3 criaturas. Mientras están en el equipo no ocupan puesto en el Rancho.
- **Ritmo**: cada criatura ataca cada `2 / (1 + VEL/100)` segundos al enemigo; el enemigo ataca a una criatura al azar.
- **Clics del jugador**: cada clic sobre el enemigo hace el daño de clic y carga la barra de habilidad del equipo un 2 %.
- **Habilidad activa**: cada criatura tiene una; se carga con el tiempo (10–20 s) y el jugador la lanza pulsando su retrato. Tipos de efecto en el MVP: daño, curación, escudo y adormecer (el enemigo no ataca 3 s).
- **Bayas en combate**: curan un 30 % de PV a una criatura (máximo 3 por combate).
- **Derrota**: las criaturas caídas quedan agotadas 2 min (no trabajan ni combaten). Sin otra penalización.
- **Victoria**: XP para el equipo y el entrenador, monedas y botín.

**Jefes de zona**

- Desbloqueo: aparecen en la zona al alcanzar el nivel indicado; se retan con un botón.
- PV ×10 respecto a una salvaje de su nivel, y una mecánica propia:
  - **Cornavid**: se cura un 5 % cada 10 s; hay que meter daño rápido.
  - **Geodrón**: escudo de piedra cada 15 s que solo rompen los clics.
  - **Marealis**: oleada cada 20 s que golpea a todo el equipo.
- Al vencerlo: se desbloquea la siguiente zona y se puede capturar al jefe. Se puede volver a retar cada 30 min para farmear.

## Progresión, tienda, logros y offline

El nivel de entrenador (1–15 en el MVP) es la columna de la progresión: cada nivel desbloquea algo visible.

| Nivel | Desbloqueo |
| --- | --- |
| 1 | Pradera, Orbe básico, 4 plazas de Rancho |
| 2 | Bayas en la tienda, Huerto |
| 3 | Equipo de combate (1 plaza) |
| 4 | Orbe de red, Mina |
| 5 | Jefe de la Pradera; Cueva tras vencerlo |
| 6 | Equipo de 2, Taller |
| 7 | Guantes de entrenador II |
| 8 | Puesto de exploración, equipo de 3 |
| 9 | Orbe lunar, Guardería |
| 10 | Jefe de la Cueva; Lago tras vencerlo |
| 12 | Amuletos de tipo |
| 15 | Jefe del Lago (fin del contenido del MVP) |

**Tienda (categorías)**

- **Mejoras de clic**: Guantes de entrenador I–V (+1, ×2…), Cebo dorado (más botín por clic).
- **Captura**: orbes por unidad y en paquetes de 10.
- **Rancho**: plazas extra, mejoras de puesto (+25 % por nivel, 3 niveles cada uno).
- **Consumibles**: bayas, Poción de prisa (CPS ×2 durante 60 s).
- **Amuletos**: +10 % a un tipo, uno equipado a la vez en el MVP.

Precio de las mejoras repetibles: `precio_base × 1,15^cantidad`.

**Logros**: unos 25 en el MVP (primer clic, 1.000 clics, capturar cada especie, vencer cada jefe, primera variocolor…). Cada uno da +1 % de producción global permanente.

**Progreso offline**: al volver se calcula la producción del Rancho por el tiempo ausente, al 50 % y con un límite de 8 h. Las bayas se consumen igual que online. Se muestra un resumen al entrar.

## Dirección visual e interfaz

**Pastel moderno** (octubre de 2026, sustituye a la dirección oscura inicial): el arte sigue siendo pixel art dibujado píxel a píxel, pero la interfaz que lo rodea es clara y actual — superficies casi blancas, líneas de 1 px, sombras difusas y pastilla de acento. Nada de marcos de consola ni mayúsculas espaciadas.

**Paleta clara**

| Uso | Color | Hex |
| --- | --- | --- |
| Fondo | Lila clarísimo | #F6F3FA |
| Lienzo de paneles | Lila teñido | #EFEAF7 |
| Superficie | Blanco | #FFFFFF |
| Superficie alterna | Nieve lila | #FAF8FD |
| Hairline | Lavanda | #ECE5F4 |
| Texto | Tinta ciruela | #2B2436 |
| Texto secundario | Ciruela suave | #594E6B |
| Texto apagado | Malva | #847A96 |
| Acento / acción | Periwinkle | #8777E5 |
| Monedas | Oro suave | #D9A33F |
| Éxito | Menta | #45B88A |
| Alerta suave | Rosa | #E87F96 |

La paleta tiene **variante oscura** (fondo #141120, superficie #1E1A2C, acento #A596F2, texto #F1ECF9): entra sola con la preferencia del sistema y hay un conmutador en la barra superior. Todos los valores son propios, así que no hay licencia que respetar.

Colores de tipo (también para *placeholders*): Planta #8FC47E · Fuego #E98F5F · Agua #74AEDC · Roca #BCA383 · Eléctrico #D9BF52 · Aire #9EC2D6. Solo aparecen teñidos detrás de los sprites y en las etiquetas de tipo.

**Formas y profundidad**

- Radios: 8 px en lo pequeño, 12 px en cajas, 18 px en paneles y 24 px en el lienzo que los contiene.
- Sombras difusas en tres niveles; nunca sombras duras ni bordes gruesos.
- Las pastillas (`border-radius: 999px`) son para recursos, etiquetas y botones de compra.

**Layout (escritorio, ≥ 1024 px)**

- **HUD** como tarjeta propia arriba: monedas, orbes, bayas, monedas por clic y CPS, cada uno con su icono pixelado de 8×8 en un cuadrado teñido; a la derecha, el nivel con su barra de XP en degradado.
- Debajo, un lienzo teñido con **tres tarjetas blancas**: zona (1 fr), Rancho (1,14 fr) y tienda (1 fr).
- Columna de zona: canvas con el objeto clicable y las salvajes; debajo, la aparición con los orbes.
- Columna del Rancho: canvas con los puestos y, debajo, pestañas de Puestos y Criaturas.
- Columna de tienda: pestañas subrayadas (Mejoras, Captura, Rancho, Consumibles) y filas de icono + texto + pastilla de compra.
- Móvil: las tres columnas se apilan; las pestañas inferiores llegan en la fase 7.

**Pixel art y escalado**

- Composición de referencia del canvas de zona: 160×160; del Rancho: 256×160. El factor de ampliación sale de ahí y siempre es entero, con `imageSmoothingEnabled = false`; el búfer se estira hasta llenar su caja para que no queden bordes muertos.
- Sprites: 16×16 para criaturas y jefes, 64×64 para el objeto clicable, 12×12 los orbes y 8×8 los iconos del HUD. Animaciones de 2–4 frames a 6–8 fps.
- Contorno de 1 px en un tono oscuro **del propio color**, nunca negro puro.
- Los sprites se colocan por su base pintada, no por el borde de su recuadro, para que apoyen en el suelo.
- Los degradados del escenario son tramados, no interpolados.

**Tipografías** (las tres son Google Fonts con licencia SIL OFL 1.1, libres también en uso comercial):

- **Outfit**: títulos, nombres y cifras.
- **Plus Jakarta Sans**: interfaz y texto corrido.
- **Pixelify Sans**: solo dentro del arte — números flotantes y cartel de la zona —, para que pertenezca al sprite y no a la interfaz.

**Feedback de clic**: número flotante en Pixelify, 4–6 partículas, escala 0,95 → 1 en 80 ms, sonido corto. Lo que le pasa a la salvaje (aparece, se escapa, huye, cae, la capturas) se anuncia en un **cartel dentro del canvas**, no en una línea debajo.

**Placeholders del MVP**

- Criaturas: **dibujadas a mano**, un mapa de 16×16 por especie en `render/creatureMaps.ts` con su paleta de seis tonos (contorno, cuerpo, luz, sombra y dos acentos). Los ojos y la sombra del suelo son comunes a todo el roster. Las variocolor reusan el mismo dibujo con la paleta alternativa.
- Objetos clicables e iconos: formas simples con el color de la zona.
- Todo sprite se resuelve por `spriteId`; cambiar a arte real es reemplazar el generador por una hoja de sprites.

## Arquitectura técnica y guardado

Vite + TypeScript sin frameworks: la lógica es TypeScript puro y testeable, el render es Canvas 2D para zona y Rancho y DOM para paneles.

**Capas**

1. **`data/`**: definiciones de contenido (especies, zonas, objetos, logros). Solo datos tipados, sin lógica.
2. **`core/`**: estado de la partida y reglas puras (producción, captura, combate, economía). Sin acceso a DOM, `window` ni `Date.now()`: el tiempo entra como parámetro. Así se testea con Vitest y se podrá reutilizar en un servidor.
3. **`systems/`**: bucle de juego con tick fijo de 100 ms que llama a `core`, más eventos (bus tipado).
4. **`render/`**: canvas de zona y Rancho, generador de *placeholders*, partículas.
5. **`ui/`**: paneles DOM (tienda, barra superior, fichas, combate) que se suscriben al estado.
6. **`persistence/`**: interfaz `SaveRepository` (`load`, `save`); MVP con `LocalSaveRepository` (localStorage) y exportar/importar en Base64. Cada partida lleva `version` y una cadena de migraciones.

**Reglas técnicas**

- Bucle: `requestAnimationFrame` para render; acumulador para ticks lógicos fijos.
- Autoguardado cada 30 s y al cerrar la pestaña (`visibilitychange`).
- El estado guarda IDs y progreso, nunca copias de los datos de contenido.
- Números como `number` en el MVP, con un formateador (1,2 K · 3,4 M); envolver la aritmética de economía para poder cambiar a `break_infinity.js`.
- Aleatoriedad con un PRNG con semilla dentro de `core`, para tests reproducibles.

**Backend (post-MVP)**: cuentas y guardado en la nube con Supabase o FastAPI + PostgreSQL, implementando `CloudSaveRepository`. Rankings con validación de plausibilidad en servidor reutilizando las fórmulas de `core`.

**Despliegue**: web estática en Cloudflare Pages o Netlify, con build automático desde GitHub.

## Alcance del MVP y roadmap

El MVP es jugable de principio a fin en unas 3–5 horas: tres zonas, 15 criaturas, combate, tienda y guardado local.

**Fases de desarrollo del MVP** (cada fase termina jugable)

1. **Esqueleto**: proyecto Vite + TS, layout de tres columnas, bucle de juego, estado, guardado local, objeto clicable de la Pradera con monedas y XP.
2. **Economía**: tienda con mejoras de clic, niveles de entrenador, formateo de números, autoguardado y exportar/importar.
3. **Captura**: apariciones, debilitar a clics, orbes, Reserva, generador de *placeholders*.
4. **Rancho**: puestos, producción pasiva, saciedad y bayas, niveles de criatura, sinergias, progreso offline.
5. **Combate**: equipo, combate automático, clics, habilidades activas, tabla de tipos.
6. **Zonas y jefes**: Cueva y Lago, los tres jefes, desbloqueos.
7. **Pulido**: logros, feedback de clic, sonido, ajuste de balance, móvil, despliegue.

**Fuera del MVP**: prestigio (Gran Expedición), zonas 4–6, Luz y Sombra, evoluciones, huevos e incubadora, Orbe maestro, cuentas y nube, rankings, arte final.

**Preguntas abiertas**

- ¿Nombre definitivo del juego?
- ¿Música en bucle en el MVP o solo efectos de sonido?
- ¿Idiomas: solo español o español e inglés desde el inicio?

## Fórmulas y valores iniciales de balance

Todos los valores son un punto de partida; viven en un archivo `data/balance.ts` para ajustarlos sin tocar la lógica.

**XP de entrenador para pasar del nivel n al n+1**

```latex
XP(n) = 100 \cdot 1{,}5^{\,n-1}
```

**Monedas por clic**

```latex
M_{clic} = (1 + G_{plano}) \cdot G_{mult} \cdot (1 + B_{minería}) \cdot (1 + B_{global})
```

**Clics automáticos por segundo** (suma sobre las criaturas del Campo de recolección)

```latex
CPS = \sum_i 0{,}5 \cdot A_i \cdot (1 + 0{,}05\,(L_i - 1)) \cdot R_i \cdot S_i \cdot T_i
```

A = aptitud (1–3), L = nivel, R = rasgo, S = factor de saciedad (1 / 0,6 / 0), T = bonus de tipo de zona (1 o 1,25). Ingreso pasivo = CPS × M\_clic.

**Probabilidad de captura**

```latex
p = \min\left(0{,}95,\; b_{rareza} \cdot m_{orbe} \cdot \left(1 + 1{,}5\left(1 - \frac{PV}{PV_{max}}\right)\right)\right)
```

| Rareza | b (captura) | Peso de aparición | XP al capturar |
| --- | --- | --- | --- |
| Común | 0,40 | 60 | 10 |
| Poco común | 0,25 | 28 | 25 |
| Rara | 0,12 | 10 | 60 |
| Épica | 0,06 | 2 | 150 |
| Legendaria | 0,03 | — (jefe) | 500 |

**Daño en combate**

```latex
D = ATQ \cdot \frac{ATQ}{ATQ + DEF} \cdot t \cdot v, \quad v \in [0{,}9;\,1{,}1]
```

t = multiplicador de tipo (1,5 / 1 / 0,67). Estadísticas al nivel L: base × (1 + 0,08 (L − 1)). XP de criatura para subir: 50 × 1,4^(L−1).

**Valores de arranque**: daño de clic 1; PV de salvajes comunes 15 en Pradera, ×1,8 por zona y ×2 por cada escalón de rareza; Guantes I a 100 monedas (+1 plano); plaza de Rancho extra a 500 × 2^k monedas.
