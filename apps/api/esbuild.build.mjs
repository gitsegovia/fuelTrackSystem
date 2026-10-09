// Build de producción (H-026): reemplaza "tsc" como generador de dist/.
//
// tsc compilaba cada .ts a su .js espejo con imports relativos sin extensión
// ("import './config'"), válidos para moduleResolution "node" pero no para el
// resolutor ESM estricto de Node — con package.json "type": "module", eso
// revienta con ERR_UNSUPPORTED_DIR_IMPORT en cuanto un import apunta a un
// directorio (ej. "./config", que es config/index.ts).
//
// esbuild bundlea src/app.ts en un solo dist/app.js con todos los imports del
// propio código ya resueltos — no hay directorios que Node tenga que resolver
// en tiempo de ejecución. `packages: "external"` deja los paquetes de
// node_modules (sequelize, pg, express, …) tal cual, sin empaquetarlos: no
// hace falta bundlear dependencias que ya son paquetes Node válidos, y evita
// problemas con las nativas opcionales de pg.
//
// El chequeo de tipos lo sigue haciendo "tsc --noEmit" por separado (sin
// cambios, sigue siendo el paso de CI); este script no tipa, solo compila.
import { build } from "esbuild";
import { cpSync, rmSync } from "fs";

rmSync("dist", { recursive: true, force: true });

// T-031: bootstrap-admin.ts es la única forma de crear el primer usuario en una instalación
// nueva (producción no siembra datos demo) — necesita su propio bundle, no solo app.ts.
// T-055: reactivate-station.ts es la única forma de reactivar una estación (sin mutation
// GraphQL, decisión de José: solo CCI Innovation puede hacerlo, corriendo este script con
// acceso al servidor) — mismo motivo para un tercer entry point.
// T-058: validate-license.ts fuerza una validación contra CCI Licencias (paso (c) del flujo de
// reactivación del contrato v2, o para cualquier otro motivo que no quiera esperar al ciclo
// diario) — cuarto entry point, mismo motivo.
// Con varios entryPoints, esbuild usa el ancestro común (src/) como base y espeja la
// estructura bajo outdir: src/app.ts → dist/app.js, src/scripts/bootstrap-admin.ts →
// dist/scripts/bootstrap-admin.js, src/scripts/reactivate-station.ts →
// dist/scripts/reactivate-station.js, src/scripts/validate-license.ts →
// dist/scripts/validate-license.js. Sin "splitting" (no hace falta: son procesos
// separados, cada uno con su propio bundle completo, sin código compartido en tiempo de
// ejecución — duplicar el grafo de módulos entre ellos es aceptable a este tamaño).
await build({
  entryPoints: [
    "src/app.ts",
    "src/scripts/bootstrap-admin.ts",
    "src/scripts/reactivate-station.ts",
    "src/scripts/validate-license.ts",
  ],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  logLevel: "info",
});

// graphql/index.ts carga los .graphql con loadFilesSync(join(__dirname, "./schemas"), …),
// __dirname derivado de import.meta.url del módulo en ejecución. Antes (tsc, sin bundlear)
// ese módulo vivía en dist/graphql/index.js → __dirname = dist/graphql. Tras el bundle, todo
// el código propio queda en un solo archivo dist/app.js → __dirname = dist. Por eso las
// schemas se copian a dist/schemas, no a dist/graphql/schemas.
cpSync("src/graphql/schemas", "dist/schemas", { recursive: true });

console.log(
  "Build de producción listo: dist/app.js, dist/scripts/bootstrap-admin.js, dist/scripts/reactivate-station.js, dist/scripts/validate-license.js + dist/schemas/"
);
