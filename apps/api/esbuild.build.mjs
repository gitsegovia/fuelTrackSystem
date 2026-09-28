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

await build({
  entryPoints: ["src/app.ts"],
  outfile: "dist/app.js",
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

console.log("Build de producción listo: dist/app.js + dist/schemas/");
