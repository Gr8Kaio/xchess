# xchess

*MK 1.1*

Ajedrez para el telefono (la interfaz esta en ingles). Contra la maquina o dos jugadores pasando el aparato.

**Jugar:** https://gr8kaio.github.io/xchess/

Es una PWA: se abre en Safari, "Compartir → Agregar a inicio", y despues arranca
en pantalla completa y anda sin internet. Toda la partida corre en el telefono,
no hay servidor ni cuenta ni nada que registrar.

## Que hace

- **Contra la maquina**, en tres niveles, eligiendo blancas, negras o al azar.
- **Dos jugadores** en el mismo telefono: el tablero se da vuelta solo despues
  de cada jugada para que cada uno vea sus piezas abajo.
- Reglas completas: enroque corto y largo, captura al paso, coronacion a las
  cuatro piezas, jaque, mate, rey ahogado, regla de las cincuenta jugadas,
  triple repeticion y tablas por material insuficiente.
- Dos formas de mover: tocar origen y destino, o **arrastrar la pieza**. El
  arrastre recien arranca cuando el dedo se corrio de verdad, asi que apoyar y
  levantar sigue siendo un toque y nunca mueve nada sin querer.
- Notacion algebraica con desambiguacion (`Nbd2`, `R1e4`), piezas comidas y
  ventaja de material.
- Deshacer, girar el tablero a mano, tema claro y oscuro.
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

## Estructura

```
index.html   la app entera: reglas, motor e interfaz
sw.js        service worker, para que abra sin señal
test.mjs     perft y tests del nucleo
```
