# xchess

*MK 1.9*

Ajedrez para el telefono (la interfaz esta en ingles). Contra la maquina o dos jugadores pasando el aparato.

**Jugar:** https://gr8kaio.github.io/xchess/

Es una PWA: se abre en Safari, "Compartir → Agregar a inicio", y despues arranca
en pantalla completa y anda sin internet. Toda la partida corre en el telefono,
no hay servidor ni cuenta ni nada que registrar.

## Que hace

- **Pantalla de inicio**: lo primero que se ve es el menu, con el modo, el
  nivel, el color y los ajustes. Si hay partida empezada aparece arriba
  "Continue game"; el boton de menu del tablero vuelve aca sin perderla.
- **Contra la maquina**, en tres niveles, eligiendo blancas, negras o al azar.
- **Dos jugadores** en el mismo telefono: el tablero se da vuelta solo despues
  de cada jugada para que cada uno vea sus piezas abajo.
- Reglas completas: enroque corto y largo, captura al paso, coronacion a las
  cuatro piezas, jaque, mate, rey ahogado, regla de las cincuenta jugadas,
  triple repeticion y tablas por material insuficiente.
- Dos formas de mover: tocar origen y destino, o **arrastrar la pieza**. El
  arrastre recien arranca cuando el dedo se corrio de verdad, asi que apoyar y
  levantar sigue siendo un toque y nunca mueve nada sin querer.
- Notacion algebraica con desambiguacion (`Nbd2`, `R1e4`) y piezas comidas.
- **Ventaja de material de los dos lados**, con signo y en peones de toda la
  vida (1/3/3/5/9): el que va arriba la ve en verde, el otro en rojo.
- **Repaso de la partida**: tocar cualquier jugada de la lista lleva el tablero
  a esa posicion, con flechas para ir y venir. Es solo para mirar; mientras se
  repasa no se puede jugar, y la partida de verdad no se toca.
- **Sonido**: un golpe seco al mover, uno mas grave al comer y dos golpes que
  bajan al dar mate, sintetizados con Web Audio. Sin archivos: la app sigue
  siendo un solo HTML.
- Al mate, **el rey se acuesta** sobre el tablero y su casilla late en rojo.
- Deshacer, girar el tablero a mano, tema claro y oscuro.
- Se mueve tocando o arrastrando; las flechas del teclado repasan la partida.
- La partida se guarda sola: si cerras la app, seguis donde estabas.

## Como esta hecho

Un solo `index.html`. Sin framework, sin build, sin dependencias: se abre el
archivo y funciona. Se publica empujando a `main`.

El archivo tiene dos partes bien separadas:

- **`<script id="nucleo">`** — las reglas, la evaluacion y la busqueda. No toca
  el DOM. Es el unico lugar donde vive el ajedrez.
- **`<script>`** siguiente — la interfaz. Sabe dibujar, no sabe jugar.

El nucleo se usa en tres lados sin copiarse: lo ejecuta la pagina, el Worker se
arma pegando el texto de ese mismo `<script>` (`textContent`) con cuatro lineas
de pegamento, y el test lo recorta del HTML y lo importa como modulo. Si se
toca una regla, se toca en los tres lados a la vez.

### El motor

Tablero 0x88, movimientos empaquetados en un entero, `hacer`/`deshacer` con
pila de deshecho. La busqueda es negamax con poda alfa-beta, hondura iterativa,
busqueda de reposo sobre las capturas, y ordenamiento por MVV-LVA, killers e
historia. La evaluacion suma material, tablas de casillas, estructura de peones
y pareja de alfiles, con el rey cambiando de tabla segun cuanto material queda.

Corre en un Web Worker, asi que la interfaz no se traba mientras piensa.

Los niveles no se diferencian buscando menos, sino aceptando jugadas peores: el
motor ve el error y a veces lo juega igual. Por eso al facil se le puede ganar.

| nivel   | hondura | tiempo | margen |
|---------|---------|--------|--------|
| facil   | 2       | 0,4 s  | 150 cp |
| normal  | 4       | 1,4 s  | 45 cp  |
| dificil | hasta 24| 2,6 s  | 0      |

## Tests

```
node test.mjs           # rapido
node test.mjs --lento   # suma los perft profundos
```

El grueso son **perft**: contar todas las hojas del arbol a N jugadas desde seis
posiciones conocidas y comparar con los numeros de referencia. Si un solo caso
de enroque, al paso o coronacion esta mal, el numero no da. Con `--lento` llega
a `perft(5) = 4.865.609` desde la posicion inicial.

Despues estan los tests de notacion, finales de partida, reglas puntuales
(clavadas, enroque cruzando jaque, al paso), evaluacion, busqueda (que encuentre
el mate en una, que se coma lo que cuelga, que no muerda un peon envenenado) y
uno que arma el Worker igual que la app para confirmar que ese pegote compila y
devuelve una jugada legal.

## Piezas

El juego de piezas lo armo franco aparte, en SVG sobre un `viewBox` de 100x100
con la misma linea de piso para las doce. Cada archivo trae su degrade con id
propio (`wN-fill`, `bN-fill`, ...), asi que las doce entran en el mismo
documento sin pisarse. Los colores vienen fijos adentro del dibujo: no siguen
el tema, igual que el tablero.

Al meterlas se les saca el bloque `<metadata>` de procedencia (C2PA): son unos
8 KB por pieza que adentro de la pagina no aportan nada. Las doce pasan de
113 KB a 23 KB.

Las doce se emparejan **por ancho** (39 unidades), cada una escalada desde la
linea de piso comun. Los factores salen de los anchos medidos, no a ojo:

| pieza   | ancho original | factor | alto final |
|---------|----------------|--------|------------|
| peon    | 36,5           | 1,069  | 52,0       |
| caballo | 40,5           | 0,963  | 60,5       |
| alfil   | 38,5           | 1,013  | 70,5       |
| torre   | 42,5           | 0,918  | 60,5       |
| dama    | 42,5           | 0,918  | 69,0       |
| rey     | 43,5           | 0,897  | 81,5       |

**Por ancho y no por alto.** Emparejar el alto obliga a estirar al peon, que es
el mas chato, y termina siendo la pieza mas ancha del tablero mientras el rey
queda la mas angosta: justo al reves de lo que uno espera (paso en MK 1.7).
Con el ancho parejo las seis pesan lo mismo en la casilla y el alto queda como
tiene que quedar, peon el mas bajo y rey el mas alto.

El ancho objetivo lo manda el rey: es el mas ancho y el mas alto a la vez, asi
que es el primero que se pega al techo. Con 39 le quedan 13 unidades de aire
arriba. Si se sube mas, el rey se sale del `viewBox` y el SVG **lo recorta al
ras** (paso en MK 1.5: la cruz quedaba cortada).

Para medir de verdad conviene renderizar cada pieza sola con `overflow:visible`
sobre un fondo plano y sacar el bounding box con PIL, en vez de estimarlo del
path.

## Estructura

```
index.html   la app entera: reglas, motor e interfaz
sw.js        service worker, para que abra sin señal
test.mjs     perft y tests del nucleo
```
