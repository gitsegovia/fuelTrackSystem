// Validación cruzada de la licencia CCI1 contra un cci-licensing real (T-054). Arranca la API con
// el entorno dado, corre licenseStatus y la apaga. La licenseKey SIEMPRE se lee de una variable de
// entorno: este script nunca la recibe por argumento ni la imprime en su salida.
//
// Uso (una corrida por instancia; usar una BD ya migrada/con el seed cargado):
//   LICENSE_KEY=... \
//   LICENSE_SERVER_URL=http://localhost:3010 \
//   LICENSE_PUBLIC_KEY="$(cat clave-publica.pem)" \
//   DB_HOST=localhost DB_PORT=5441 DB_DATABASE=fueltrack_verify DB_USER=verify DB_PASS=verify \
//   node scripts/cross-validate-license.mjs
//
// Variables opcionales: PORT (4540), FINGERPRINT_PATH (si no existe, se crea con un fingerprint de
// prueba fijo — ver T-054, "cuidado con A": una instancia sin validar fija su fingerprint para
// siempre con la primera llamada), CROSS_VALIDATE_TIMEOUT_MS (60000).

import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const required = ["LICENSE_KEY", "LICENSE_SERVER_URL", "LICENSE_PUBLIC_KEY", "DB_HOST", "DB_PORT", "DB_DATABASE", "DB_USER", "DB_PASS"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables de entorno: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = process.env.PORT ?? "4540";
const FINGERPRINT_PATH = process.env.FINGERPRINT_PATH ?? "./cross-validate-fingerprint.tmp";
if (!existsSync(FINGERPRINT_PATH)) {
  writeFileSync(FINGERPRINT_PATH, process.env.CROSS_VALIDATE_FINGERPRINT ?? "ft054-fixed-test-fingerprint-20261008");
}

const env = {
  ...process.env,
  PORT,
  FINGERPRINT_PATH,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  JWT_SECRET: process.env.JWT_SECRET ?? "cross-validate-only-not-a-real-secret",
  SESSION_MAX_HOURS: process.env.SESSION_MAX_HOURS ?? "24",
  ACCESS_TOKEN_MINUTES: process.env.ACCESS_TOKEN_MINUTES ?? "15",
  REFRESH_GRACE_SECONDS: process.env.REFRESH_GRACE_SECONDS ?? "60",
};

const child = spawn(
  "node",
  ["--loader", "ts-node/esm", "--experimental-specifier-resolution=node", "src/app.ts"],
  { env, stdio: ["ignore", "pipe", "pipe"] }
);

let booted = false;
let output = "";
const onData = (d) => {
  output += d.toString();
  if (/Server ready|modo de licencia inválida/.test(output)) booted = true;
};
child.stdout.on("data", onData);
child.stderr.on("data", onData);

const timeoutMs = Number(process.env.CROSS_VALIDATE_TIMEOUT_MS ?? 60000);
const start = Date.now();
while (!booted && Date.now() - start < timeoutMs) {
  await new Promise((r) => setTimeout(r, 500));
}
if (!booted) {
  console.error("La API no arrancó a tiempo. Salida capturada:\n" + output);
  child.kill();
  process.exit(1);
}

const API_URL = `http://localhost:${PORT}/graphql`;
const invalidLicenseMode = /modo de licencia inválida/.test(output);

async function gql(query, variables = {}, token) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

try {
  if (invalidLicenseMode) {
    const probe = await fetch(API_URL).catch(() => null);
    console.log(JSON.stringify({ outcome: "INVALID_LICENSE_MODE", httpStatus: probe?.status ?? null }, null, 2));
  } else {
    const login = await gql(`mutation { login(input: { username: "admin.petronorte", password: "Demo1234!" }) { token } }`);
    if (login.errors) {
      console.log(JSON.stringify({ outcome: "BOOTED_BUT_LOGIN_FAILED", error: login.errors[0].message }, null, 2));
    } else {
      const status = await gql(
        `{ licenseStatus { mode status plan maxStations activeStations expiresAt graceEndsAt daysRemaining readOnly customerName lastValidatedAt clockSkewDetected trial authorizedStationIds unauthorizedStationIds } }`,
        {},
        login.data.login.token
      );
      console.log(JSON.stringify({ outcome: "BOOTED", licenseStatus: status.data?.licenseStatus }, null, 2));
    }
  }
} finally {
  child.kill();
}
