// Verificación de licencia contra la API real (T-050): licenseStatus, tope de estaciones y
// solo-lectura. Uso:
//   API_URL=http://localhost:4000/graphql node scripts/smoke-license.mjs
// Opcional, para afirmar un estado concreto (si no, solo informa):
//   EXPECT_STATUS=ACTIVE|DUE_SOON|GRACE|READ_ONLY|LEGACY EXPECT_READONLY=true|false node ...
// Contraseña de los usuarios demo: Demo1234!

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";
const PASSWORD = "Demo1234!";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function gql(query, variables = {}, token) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
const codeOf = (r) => (r.errors ? r.errors[0]?.extensions?.code ?? "ERROR" : "OK");

const login = await gql(`mutation { login(input: { username: "admin.petronorte", password: "${PASSWORD}" }) { token user { company { id } } } }`);
if (login.errors) throw new Error(`login: ${login.errors[0].message}`);
const token = login.data.login.token;
const companyId = login.data.login.user.company.id;

const statusRes = await gql(`{ licenseStatus { mode status plan maxStations activeStations expiresAt graceEndsAt daysRemaining readOnly customerName lastValidatedAt clockSkewDetected } }`, {}, token);
if (statusRes.errors) throw new Error(`licenseStatus: ${statusRes.errors[0].message}`);
const status = statusRes.data.licenseStatus;
console.log("licenseStatus:", JSON.stringify(status));

const suffix = Date.now();
const stationAttempt = await gql(
  `mutation($input: CreateGasStationInput!) { createGasStation(input: $input) { id } }`,
  { input: { name: `Prueba límite ${suffix}`, code: `LIM-${suffix}`, companyId } },
  token
);
const currencyAttempt = await gql(
  `mutation($input: CreateCurrencyInput!) { createCurrency(input: $input) { id } }`,
  { input: { name: `Prueba ${suffix}`, symbol: `P${suffix % 100}`, exchangeRate: 1 } },
  token
);
console.log("createGasStation ->", codeOf(stationAttempt), stationAttempt.errors?.[0]?.message ?? "");
console.log("createCurrency  ->", codeOf(currencyAttempt), currencyAttempt.errors?.[0]?.message ?? "");

// Precedencia del gate (src/license/gate.ts): solo lectura se revisa antes que el tope de
// estaciones, así que en solo lectura createGasStation también da LICENSE_READ_ONLY.
const atStationLimit = status.maxStations != null && status.activeStations >= status.maxStations;
if (status.readOnly) {
  check("en solo lectura, createGasStation da LICENSE_READ_ONLY (antes que el tope)", codeOf(stationAttempt) === "LICENSE_READ_ONLY", codeOf(stationAttempt));
  check("en solo lectura, una mutation cualquiera da LICENSE_READ_ONLY", codeOf(currencyAttempt) === "LICENSE_READ_ONLY", codeOf(currencyAttempt));
} else {
  if (atStationLimit) {
    check("en el tope de estaciones, crear una más da LICENSE_STATION_LIMIT", codeOf(stationAttempt) === "LICENSE_STATION_LIMIT", codeOf(stationAttempt));
  }
  check("fuera de solo lectura, una mutation normal no da error de licencia", !["LICENSE_READ_ONLY", "LICENSE_STATION_LIMIT"].includes(codeOf(currencyAttempt)), codeOf(currencyAttempt));
}

if (process.env.EXPECT_STATUS) {
  check(`status esperado: ${process.env.EXPECT_STATUS}`, String(status.status ?? status.mode) === process.env.EXPECT_STATUS);
}
if (process.env.EXPECT_READONLY) {
  check(`readOnly esperado: ${process.env.EXPECT_READONLY}`, String(status.readOnly) === process.env.EXPECT_READONLY);
}
if (process.env.EXPECT_CLOCK_SKEW) {
  check(`clockSkewDetected esperado: ${process.env.EXPECT_CLOCK_SKEW}`, String(status.clockSkewDetected) === process.env.EXPECT_CLOCK_SKEW);
}

console.log(`\n${failures === 0 ? "todas las comprobaciones pasaron" : `${failures} comprobación(es) fallaron`}`);
process.exit(failures > 0 ? 1 : 0);
