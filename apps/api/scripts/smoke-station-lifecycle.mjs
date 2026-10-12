// Desactivar/reactivar estaciones y la propuesta D-19 (T-055). Requiere la API arriba, el seed
// cargado, y las mismas variables DB_* que usa la API (para poder correr reactivate-station.ts
// como lo haría José, contra la misma BD). Uso:
//   API_URL=http://localhost:4000/graphql \
//   DB_CONNECTOR=postgres DB_HOST=... DB_PORT=... DB_DATABASE=... DB_USER=... DB_PASS=... \
//   node scripts/smoke-station-lifecycle.mjs
// Contraseña de los usuarios demo y de los que crea este script: Demo1234!

import { spawn } from "node:child_process";

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

async function login(username, password = PASSWORD) {
  return gql(
    `mutation($u: String!, $p: String!) { login(input: { username: $u, password: $p }) { token refreshToken user { id } } }`,
    { u: username, p: password }
  );
}

function runReactivateScript(args) {
  return new Promise((resolve) => {
    const child = spawn(
      "node",
      ["--loader", "ts-node/esm", "--experimental-specifier-resolution=node", "src/scripts/reactivate-station.ts", "--", ...args],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

const admin = await login("admin.petronorte");
if (admin.errors) throw new Error(`login admin: ${admin.errors[0].message}`);
const T_ADMIN = admin.data.login.token;
const companyId = (await gql(`{ me { company { id } } }`, {}, T_ADMIN)).data.me.company.id;

console.log("\n== 0. No existe forma de reactivar por GraphQL ==");
const introspection = await gql(`{ mutationType: __type(name: "Mutation") { fields { name } } updateInput: __type(name: "UpdateGasStationInput") { inputFields { name } } }`, {}, T_ADMIN);
const mutationNames = introspection.data.mutationType.fields.map((f) => f.name);
const updateInputFields = introspection.data.updateInput.inputFields.map((f) => f.name);
check("no hay mutation reactivateGasStation", !mutationNames.includes("reactivateGasStation"));
check("UpdateGasStationInput no tiene el campo active", !updateInputFields.includes("active"));

console.log("\n== 1. Estación sin trabajo: desactivar funciona, el filtro active la refleja ==");
const suffix = Date.now();
const created = await gql(
  `mutation($input: CreateGasStationInput!) { createGasStation(input: $input) { id active } }`,
  { input: { name: `Estación de prueba T055 ${suffix}`, code: `T055-${suffix}`, companyId } },
  T_ADMIN
);
if (created.errors) throw new Error(`createGasStation: ${created.errors[0].message}`);
const stationId = created.data.createGasStation.id;
check("la estación nace activa", created.data.createGasStation.active === true);

console.log("\n== 2. Estación con trabajo abierto: desactivar se rechaza ==");
const stations = (await gql(`{ gasStations(active: true) { id name } }`, {}, T_ADMIN)).data.gasStations;
const sur = stations.find((s) => s.name === "Estación Sur");
const deactivateSur = await gql(`mutation($id: UUID!) { deactivateGasStation(id: $id) { id } }`, { id: sur.id }, T_ADMIN);
check(
  "desactivar Estación Sur (turno y ticket abiertos del seed) -> STATION_HAS_OPEN_WORK",
  codeOf(deactivateSur) === "STATION_HAS_OPEN_WORK",
  JSON.stringify(deactivateSur.errors?.[0])
);
const openWorkDetail = deactivateSur.errors?.[0]?.extensions;
check(
  "el error trae el detalle (openShifts/openTickets)",
  openWorkDetail && typeof openWorkDetail.openShifts === "number" && typeof openWorkDetail.openTickets === "number" && (openWorkDetail.openShifts > 0 || openWorkDetail.openTickets > 0),
  JSON.stringify(openWorkDetail)
);

console.log("\n== 3. D-19: empleado con sesión vigente, luego se desactiva su estación ==");
const empUsername = `emp.t055.${suffix}`;
const empCreate = await gql(
  `mutation($input: CreateUserInput!) { createUser(input: $input) { id } }`,
  { input: { username: empUsername, password: PASSWORD, role: "EMPLOYEE", userType: "Cashier", companyId, gasStationId: stationId } },
  T_ADMIN
);
if (empCreate.errors) throw new Error(`createUser: ${empCreate.errors[0].message}`);

// La estación todavía está activa (paso 1 solo la creó): logueamos mientras está activa, para
// tener un token y un refreshToken vigentes, y recién después la desactivamos.
const empSession = await login(empUsername);
if (empSession.errors) throw new Error(`login empleado: ${empSession.errors[0].message}`);
const T_EMP = empSession.data.login.token;
const refreshToken = empSession.data.login.refreshToken;
const empId = empSession.data.login.user.id;

const deactivated = await gql(`mutation($id: UUID!) { deactivateGasStation(id: $id) { id active } }`, { id: stationId }, T_ADMIN);
check("desactivar una estación sin turnos ni tickets -> OK", !deactivated.errors && deactivated.data.deactivateGasStation.active === false, deactivated.errors?.[0]?.message);

const listActive = await gql(`{ gasStations(active: true) { id } }`, {}, T_ADMIN);
const listInactive = await gql(`{ gasStations(active: false) { id } }`, {}, T_ADMIN);
const listAll = await gql(`{ gasStations { id } }`, {}, T_ADMIN);
check("gasStations(active: true) ya no la incluye", !listActive.data.gasStations.some((s) => s.id === stationId));
check("gasStations(active: false) sí la incluye", listInactive.data.gasStations.some((s) => s.id === stationId));
check("gasStations() sin filtro incluye todas (para reportes)", listAll.data.gasStations.some((s) => s.id === stationId));

const loginAfterInactive = await login(empUsername);
check("login de un empleado cuya estación ya está inactiva -> STATION_INACTIVE", codeOf(loginAfterInactive) === "STATION_INACTIVE", codeOf(loginAfterInactive));

const refreshAfterInactive = await gql(`mutation($r: String!) { refreshSession(refreshToken: $r) { token } }`, { r: refreshToken });
check("refreshSession con una sesión ya iniciada, estación ahora inactiva -> STATION_INACTIVE", codeOf(refreshAfterInactive) === "STATION_INACTIVE", codeOf(refreshAfterInactive));

const shiftAttempt = await gql(
  `mutation($input: CreateEmployeeShiftInput!) { createEmployeeShift(input: $input) { id } }`,
  { input: { employeeId: empId, gasStationId: stationId, shiftStartTime: new Date().toISOString(), employeeRole: "CASHIER" } },
  T_EMP
);
check("mutation operativa (createEmployeeShift) en estación inactiva, con el token todavía vigente -> STATION_INACTIVE", codeOf(shiftAttempt) === "STATION_INACTIVE", JSON.stringify(shiftAttempt.errors?.[0]));

const adminStillWorks = await gql(`{ me { id } }`, {}, T_ADMIN);
check("admin (alcance de empresa) no se ve afectado", !adminStillWorks.errors);

const historyQuery = await gql(
  `query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { id } employeeShiftsByGasStation(gasStationId: $id) { id } }`,
  { id: stationId },
  T_ADMIN
);
check("el histórico de la estación inactiva sigue consultable (queries, no mutations)", !historyQuery.errors, JSON.stringify(historyQuery.errors?.[0]));

console.log("\n== 4. Reactivar: solo con el script de servidor, no por GraphQL ==");
const reactivateResult = await runReactivateScript(["--id", stationId, "--operator", "smoke-test"]);
check("reactivate-station.ts sale con código 0", reactivateResult.exitCode === 0, `exit=${reactivateResult.exitCode} stderr=${reactivateResult.stderr.slice(0, 300)}`);
check("el script deja constancia de quién y cuándo", /reactivada/.test(reactivateResult.stdout) && /smoke-test/.test(reactivateResult.stdout), reactivateResult.stdout.slice(0, 300));

const stationAfterScript = await gql(`query($id: UUID!) { gasStation(id: $id) { active } }`, { id: stationId }, T_ADMIN);
check("la estación vuelve a estar activa", stationAfterScript.data?.gasStation?.active === true);

const loginAfterReactivate = await login(empUsername);
check("el empleado vuelve a entrar tras reactivar", !loginAfterReactivate.errors, loginAfterReactivate.errors?.[0]?.message);

const reactivateAgain = await runReactivateScript(["--id", stationId]);
check("reactivar una que ya está activa es idempotente (exit 0, no hace nada)", reactivateAgain.exitCode === 0 && /ya está activa/.test(reactivateAgain.stdout), reactivateAgain.stdout.slice(0, 200));

console.log(`\n${failures === 0 ? "todas las comprobaciones pasaron" : `${failures} comprobación(es) fallaron`}`);
process.exit(failures > 0 ? 1 : 0);
