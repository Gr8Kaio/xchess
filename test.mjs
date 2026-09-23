/* Tests del nucleo de xchess.

   La logica vive adentro de index.html (la app es un solo archivo). En vez de
   duplicarla, se recorta el <script id="nucleo"> y se importa como modulo: asi
   el test no se puede desincronizar del codigo que se publica.

   El grueso son perft: contar todas las hojas del arbol a N jugadas desde
   posiciones conocidas. Si un solo caso de enroque, al paso o coronacion esta
   mal, el numero no da. Los valores de referencia son los de la Chess
   Programming Wiki.

   Correr con:  node test.mjs          (rapido, perft hasta hondura media)
                node test.mjs --lento  (suma los perft caros)
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const abre = html.indexOf('<script id="nucleo">');
const cierra = html.indexOf("</script>", abre);
if (abre < 0 || cierra < 0){ console.error("No encontre el <script id=nucleo> en index.html"); process.exit(1); }
const exporta = [
  "VACIO","PEON","CABALLO","ALFIL","TORRE","DAMA","REY","BLANCO","NEGRO",
  "tipo","colorDe","rival","dentro","filaDe","colDe",
  "F_COME","F_PASO","F_ENROQUE","F_DOBLE","F_CORONA",
  "armar","mvDe","mvA","mvCorona","mvF",
  "INICIAL","desdeFen","aFen","nombre","desdeNombre","clave",
  "atacado","enJaque","generar","hacer","deshacer","legales",
  "materialPobre","estado","san","evaluar","crearBuscador","NIVELES","VALOR",
];
const fuente = html.slice(abre + '<script id="nucleo">'.length, cierra)
  + "\nexport {" + exporta.join(",") + "};\n";
const tmp = path.join(os.tmpdir(), "xchess-nucleo-" + process.pid + ".mjs");
fs.writeFileSync(tmp, fuente, "utf8");
const L = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const LENTO = process.argv.includes("--lento");
let fallos = 0, corridos = 0;
const ok = (cond, msg) => { corridos++; if (!cond){ console.log("  FALLA: " + msg); fallos++; } };
const igual = (a, b, msg) => ok(a === b, `${msg}  (dio ${a}, esperaba ${b})`);
const titulo = t => console.log("\n" + t);

/* ------------------------------------------------------------------ perft */
function perft(pos, prof){
  if (prof === 0) return 1;
  const yo = pos.turno, i = yo === L.BLANCO ? 0 : 1;
  let n = 0;
  for (const mv of L.generar(pos, false)){
    L.hacer(pos, mv);
    if (!L.atacado(pos, pos.reyes[i], L.rival(yo))) n += perft(pos, prof - 1);
    L.deshacer(pos);
  }
  return n;
}

/* Posiciones estandar. Cada una pega en un rincon distinto de las reglas. */
const CASOS = [
  { nom: "inicial", fen: L.INICIAL,
    n: [20, 400, 8902, 197281, 4865609], lento: 4 },
  { nom: "kiwipete (enroques y clavadas)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    n: [48, 2039, 97862, 4085603], lento: 3 },
  { nom: "posicion 3 (finales y al paso)",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    n: [14, 191, 2812, 43238, 674624], lento: 4 },
  { nom: "posicion 4 (coronaciones)",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    n: [6, 264, 9467, 422333], lento: 3 },
  { nom: "posicion 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    n: [44, 1486, 62379, 2103487], lento: 3 },
  { nom: "posicion 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    n: [46, 2079, 89890, 3894594], lento: 3 },
];

titulo("perft");
for (const c of CASOS){
  const hasta = LENTO ? c.n.length : Math.min(c.n.length, c.lento);
  for (let d = 1; d <= hasta; d++){
    const pos = L.desdeFen(c.fen);
    const t0 = Date.now();
    const dio = perft(pos, d);
    const ms = Date.now() - t0;
    igual(dio, c.n[d - 1], `${c.nom} perft(${d})`);
    if (dio === c.n[d - 1]) console.log(`  ok  ${c.nom} perft(${d}) = ${dio}${ms > 400 ? "  (" + ms + "ms)" : ""}`);
    /* Ademas: hacer/deshacer tiene que dejar la posicion identica. */
    igual(L.aFen(pos), c.fen, `${c.nom}: deshacer no restauro la posicion`);
  }
}

/* --------------------------------------------------------------- notacion */
titulo("notacion algebraica");
{
  const pos = L.desdeFen(L.INICIAL);
  const texto = mv => L.san(pos, mv, L.legales(pos));
  const buscar = (de, a) => L.legales(pos).find(m => L.nombre(L.mvDe(m)) === de && L.nombre(L.mvA(m)) === a);
  igual(texto(buscar("e2", "e4")), "e4", "avance de peon");
  igual(texto(buscar("g1", "f3")), "Nf3", "salida de caballo");
}
{
  // Dos caballos llegan a d2: hay que desambiguar por columna.
  const pos = L.desdeFen("4k3/8/8/8/8/8/8/1N1K1N2 w - - 0 1");
  const ms = L.legales(pos);
  const aD2 = ms.filter(m => L.nombre(L.mvA(m)) === "d2" && L.tipo(pos.t[L.mvDe(m)]) === L.CABALLO);
  igual(aD2.length, 2, "dos caballos llegan a d2");
  const textos = aD2.map(m => L.san(pos, m, ms)).sort();
  igual(textos.join(","), "Nbd2,Nfd2", "desambiguacion por columna");
}
{
  // Enroque, jaque y mate.
  const pos = L.desdeFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const ms = L.legales(pos);
  const corto = ms.find(m => L.mvF(m) & L.F_ENROQUE && L.colDe(L.mvA(m)) === 6);
  const largo = ms.find(m => L.mvF(m) & L.F_ENROQUE && L.colDe(L.mvA(m)) === 2);
  igual(L.san(pos, corto, ms), "O-O", "enroque corto");
  igual(L.san(pos, largo, ms), "O-O-O", "enroque largo");
}
{
  // Mate del pastor: la ultima jugada lleva '#'.
  const pos = L.desdeFen("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
  const ms = L.legales(pos);
  const mate = ms.find(m => L.nombre(L.mvDe(m)) === "f3" && L.nombre(L.mvA(m)) === "f7");
  igual(L.san(pos, mate, ms), "Qxf7#", "mate del pastor");
  L.hacer(pos, mate);
  igual(L.estado(pos, 1), "mate", "la posicion queda en mate");
}

/* ----------------------------------------------------------- fin de partida */
titulo("finales de partida");
{
  const ahogado = L.desdeFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  igual(L.estado(ahogado, 1), "ahogado", "rey ahogado");
  igual(L.legales(ahogado).length, 0, "no hay jugada legal");
  ok(!L.enJaque(ahogado), "ahogado no es jaque");
}
{
  igual(L.estado(L.desdeFen("7k/8/6K1/8/8/8/8/8 w - - 0 1"), 1), "material", "rey contra rey");
  igual(L.estado(L.desdeFen("7k/8/6K1/8/8/8/8/5B2 w - - 0 1"), 1), "material", "rey y alfil");
  igual(L.estado(L.desdeFen("7k/8/6K1/8/8/8/8/5N2 w - - 0 1"), 1), "material", "rey y caballo");
  ok(!L.materialPobre(L.desdeFen("7k/8/6K1/8/8/8/8/5R2 w - - 0 1")), "rey y torre si da mate");
  ok(!L.materialPobre(L.desdeFen("7k/4p3/6K1/8/8/8/8/8 w - - 0 1")), "con peon no son tablas");
}
{
  const cincuenta = L.desdeFen("8/8/4k3/8/8/4K3/8/7R w - - 100 80");
  igual(L.estado(cincuenta, 1), "cincuenta", "regla de las cincuenta jugadas");
  igual(L.estado(L.desdeFen("8/8/4k3/8/8/4K3/8/7R w - - 10 80"), 3), "repeticion", "triple repeticion");
}

/* ------------------------------------------------------- reglas puntuales */
titulo("reglas puntuales");
{
  // Al paso: solo el turno inmediatamente siguiente.
  const pos = L.desdeFen("8/8/8/3pP3/8/8/8/4K2k w - d6 0 1");
  const paso = L.legales(pos).find(m => L.mvF(m) & L.F_PASO);
  ok(!!paso, "la captura al paso existe");
  L.hacer(pos, paso);
  igual(pos.t[L.desdeNombre("d5")], 0, "el peon comido al paso desaparece");
  igual(L.tipo(pos.t[L.desdeNombre("d6")]), L.PEON, "el peon quedo en d6");
  L.deshacer(pos);
  igual(L.aFen(pos), "8/8/8/3pP3/8/8/8/4K2k w - d6 0 1", "deshacer restaura el al paso");
}
{
  // No se puede enrocar cruzando una casilla atacada.
  const pos = L.desdeFen("4k3/8/8/8/8/8/5r2/4K2R w K - 0 1");
  ok(!L.legales(pos).some(m => L.mvF(m) & L.F_ENROQUE), "no se enroca pasando por jaque");
}
{
  // Mover la torre pierde solo ese lado del enroque.
  const pos = L.desdeFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const h1h2 = L.legales(pos).find(m => L.nombre(L.mvDe(m)) === "h1" && L.nombre(L.mvA(m)) === "h2");
  L.hacer(pos, h1h2);
  igual(pos.enroque & 1, 0, "se perdio el enroque corto blanco");
  igual(pos.enroque & 2, 2, "sigue el enroque largo blanco");
  igual(pos.enroque & 12, 12, "los negros conservan los dos");
}
{
  // Una pieza clavada no se puede mover: la torre negra de e8 clava al
  // caballo de e2 contra el rey de e1.
  const pos = L.desdeFen("k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1");
  ok(!L.legales(pos).some(m => L.nombre(L.mvDe(m)) === "e2"), "el caballo clavado no se mueve");
}
{
  // Coronar da las cuatro opciones.
  const pos = L.desdeFen("8/4P3/8/8/8/8/8/4K2k w - - 0 1");
  const cs = L.legales(pos).filter(m => L.mvF(m) & L.F_CORONA);
  igual(cs.length, 4, "cuatro coronaciones");
  igual(new Set(cs.map(L.mvCorona)).size, 4, "dama, torre, alfil y caballo");
  const aCaballo = cs.find(m => L.mvCorona(m) === L.CABALLO);
  L.hacer(pos, aCaballo);
  igual(L.tipo(pos.t[L.desdeNombre("e8")]), L.CABALLO, "corono en caballo");
  L.deshacer(pos);
  igual(L.tipo(pos.t[L.desdeNombre("e7")]), L.PEON, "al deshacer vuelve a ser peon");
}

/* ------------------------------------------------------------ evaluacion */
titulo("evaluacion");
{
  igual(L.evaluar(L.desdeFen(L.INICIAL)), L.evaluar(L.desdeFen(L.INICIAL)), "es determinista");
  ok(Math.abs(L.evaluar(L.desdeFen(L.INICIAL))) < 40, "la posicion inicial esta pareja");
  // Una dama de mas tiene que valer mucho, mire quien mire.
  const conDama = L.desdeFen("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
  ok(L.evaluar(conDama) > 700, "con dama de mas, gana el que mueve");
  const contra = L.desdeFen("4k3/8/8/8/8/8/8/3QK3 b - - 0 1");
  ok(L.evaluar(contra) < -700, "y pierde el otro");
}

/* --------------------------------------------------------------- busqueda */
titulo("busqueda");
{
  const buscar = L.crearBuscador();
  // Mate en una: tiene que encontrarlo si o si.
  const m1 = L.desdeFen("6k1/5ppp/8/8/8/8/8/R3K2R w KQ - 0 1");
  const r = buscar(m1, { prof: 3, ms: 3000, azar: 0 });
  const ms = L.legales(m1);
  igual(L.san(m1, r.mv, ms), "Ra8#", "encuentra el mate en una");
}
{
  const buscar = L.crearBuscador();
  // Dama colgada: agarrarla es gratis.
  const pos = L.desdeFen("4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1");
  const r = buscar(pos, { prof: 4, ms: 3000, azar: 0 });
  igual(L.san(pos, r.mv, L.legales(pos)), "exd5", "se come la dama colgada");
}
{
  const buscar = L.crearBuscador();
  // No comer un peon envenenado: detras hay una torre.
  const pos = L.desdeFen("4k3/8/8/8/8/3p4/4B3/4K2r w - - 0 1");
  const r = buscar(pos, { prof: 4, ms: 3000, azar: 0 });
  ok(L.san(pos, r.mv, L.legales(pos)) !== "Bxd3", "no cae en el peon envenenado");
}
{
  const buscar = L.crearBuscador();
  // La jugada que devuelve siempre tiene que ser legal.
  const pos = L.desdeFen("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
  for (const nivel of ["facil", "normal", "dificil"]){
    const r = buscar(pos, L.NIVELES[nivel]);
    ok(r && L.legales(pos).includes(r.mv), `nivel ${nivel} devuelve una jugada legal`);
  }
}
{
  const buscar = L.crearBuscador();
  // Aun con el reloj en cero tiene que devolver algo.
  const pos = L.desdeFen(L.INICIAL);
  const r = buscar(pos, { prof: 20, ms: 1, azar: 0 });
  ok(r && L.legales(pos).includes(r.mv), "con tiempo cero igual devuelve jugada legal");
}
{
  const buscar = L.crearBuscador();
  // El facil tiene que jugar distinto de vez en cuando; si no, no es facil.
  const pos = L.desdeFen("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
  const vistas = new Set();
  for (let i = 0; i < 25; i++) vistas.add(buscar(pos, L.NIVELES.facil).mv);
  ok(vistas.size > 1, "el nivel facil varia sus jugadas");
}

/* --------------------------------------------------------------- worker */
/* La app arma el Worker pegando el texto del <script id="nucleo"> con un
   pedacito de pegamento. Si esa union no compila, el motor no contesta nunca
   y en el navegador se ve como que "se colgo". Aca se corre el mismo pegote
   en un worker de node, que es lo mas parecido sin abrir un browser. */
titulo("worker del motor");
{
  const m = html.match(/const pegamento = `([\s\S]*?)`;/);
  ok(!!m, "encontre el pegamento del worker en index.html");
  if (m){
    const nucleo = html.slice(abre + '<script id="nucleo">'.length, cierra);
    const puente = `
      const { parentPort } = require("node:worker_threads");
      globalThis.postMessage = msg => parentPort.postMessage(msg);
      parentPort.on("message", d => globalThis.onmessage({ data: d }));
    `;
    const archivo = path.join(os.tmpdir(), "xchess-worker-" + process.pid + ".cjs");
    fs.writeFileSync(archivo, nucleo + m[1] + puente, "utf8");

    const { Worker } = await import("node:worker_threads");
    const w = new Worker(archivo);
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const r = await new Promise((res, rej) => {
      const reloj = setTimeout(() => rej(new Error("no contesto en 10s")), 10000);
      w.on("message", d => { clearTimeout(reloj); res(d); });
      w.on("error", e => { clearTimeout(reloj); rej(e); });
      w.postMessage({ fen, op: L.NIVELES.normal });
    }).catch(e => ({ error: e.message }));
    await w.terminate();
    fs.unlinkSync(archivo);

    ok(r && !r.error, "el worker contesta sin romperse" + (r && r.error ? ": " + r.error : ""));
    if (r && !r.error){
      const pos = L.desdeFen(fen);
      ok(L.legales(pos).includes(r.mv), "la jugada que manda el worker es legal");
      ok(r.prof >= 1 && r.nodos > 0, "el worker informa hondura y nodos");
    }
  }
}

/* ----------------------------------------------------------------- FEN */
titulo("FEN");
for (const f of [L.INICIAL,
                 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
                 "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 3 12",
                 "8/8/8/3pP3/8/8/8/4K2k w - d6 0 1"]){
  igual(L.aFen(L.desdeFen(f)), f, "ida y vuelta: " + f.slice(0, 28));
}
igual(L.clave(L.desdeFen(L.INICIAL)), L.INICIAL.split(" ").slice(0, 4).join(" "), "la clave ignora los contadores");

/* -------------------------------------------------------------- resultado */
console.log("\n" + (fallos
  ? `${fallos} de ${corridos} comprobaciones fallaron`
  : `todo bien: ${corridos} comprobaciones`));
if (!LENTO) console.log("(corre con --lento para los perft profundos)");
process.exit(fallos ? 1 : 0);
