// Pruebas de autenticación y autorización (ADR-016, T-042). Requiere la API arriba y el seed cargado.
// Uso: API_URL=http://localhost:4000/graphql node scripts/smoke-authz.mjs
// Contraseña de los usuarios demo: Demo1234!

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";
const PASSWORD = "Demo1234!";
const FAKE_ID = "00000000-0000-0000-0000-000000000000";

let failures = 0;
let passes = 0;
const check = (label, ok, detail = "") => {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
};

async function gql(query, variables = {}, token, headers = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const codeOf = (r) => (r.errors ? r.errors[0]?.extensions?.code ?? "ERROR" : "OK");
const denied = (r) => ["FORBIDDEN", "UNAUTHENTICATED"].includes(codeOf(r));

async function login(username) {
  const r = await gql(`mutation($u: String!, $p: String!) { login(input: { username: $u, password: $p }) { token refreshToken user { id company { id } employeeProfile { id } } } }`, { u: username, p: PASSWORD });
  if (r.errors) throw new Error(`login ${username}: ${r.errors[0].message}`);
  return r.data.login;
}

// ── Esquema: construir argumentos válidos por tipo (para que la validación de GraphQL pase) ──
const schemaRes = await gql(`{ __schema { queryType { name } mutationType { name } types { name kind fields { name args { name type { ...T } } type { ...T } } inputFields { name type { ...T } } enumValues { name } } } } fragment T on __Type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }`);
const TYPES = Object.fromEntries(schemaRes.data.__schema.types.map((t) => [t.name, t]));
const OPS = {
  Query: TYPES[schemaRes.data.__schema.queryType.name].fields,
  Mutation: TYPES[schemaRes.data.__schema.mutationType.name].fields,
};

const unwrap = (t) => {
  let cur = t;
  let nonNull = false;
  while (cur.kind === "NON_NULL" || cur.kind === "LIST") {
    if (cur.kind === "NON_NULL") nonNull = true;
    cur = cur.ofType;
  }
  return { named: cur, nonNull };
};

const SCALAR_LIT = {
  UUID: `"${FAKE_ID}"`, String: '"x"', Decimal: "1", Float: "1", Int: "1", Boolean: "true",
  DateTime: '"2026-01-01T00:00:00.000Z"', Date: '"2026-01-01"',
};

function valueLit(type, value) {
  return unwrap(type).named.kind === "ENUM" ? String(value) : JSON.stringify(value);
}

function literal(type, overrides, depth = 0) {
  const { named, nonNull } = unwrap(type);
  let outer = type;
  while (outer.kind === "NON_NULL") outer = outer.ofType;
  if (outer.kind === "LIST") return "[]";
  if (named.kind === "SCALAR") return SCALAR_LIT[named.name] ?? '"x"';
  if (named.kind === "ENUM") return TYPES[named.name].enumValues[0].name;
  if (named.kind === "INPUT_OBJECT" && depth < 4) {
    const fields = TYPES[named.name].inputFields
      .filter((f) => f.name in overrides || unwrap(f.type).nonNull)
      .map((f) => `${f.name}: ${f.name in overrides ? valueLit(f.type, overrides[f.name]) : literal(f.type, overrides, depth + 1)}`);
    return `{ ${fields.join(", ")} }`;
  }
  return nonNull ? "null" : "null";
}

function buildCall(kind, field, overrides = {}) {
  const def = OPS[kind].find((f) => f.name === field);
  const args = def.args.map((a) => {
    const v = overrides[a.name];
    const isObject = v && typeof v === "object" && !Array.isArray(v);
    const val = a.name in overrides
      ? isObject ? literal(a.type, { ...overrides, ...v }) : valueLit(a.type, v)
      : literal(a.type, overrides);
    return `${a.name}: ${val}`;
  });
  const { named } = unwrap(def.type);
  const selection = TYPES[named.name]?.kind === "OBJECT" ? " { __typename }" : "";
  const argList = args.length ? `(${args.join(", ")})` : "";
  return `${kind.toLowerCase()} { ${field}${argList}${selection} }`;
}

const call = (token, kind, field, overrides = {}, headers = {}) =>
  gql(buildCall(kind, field, overrides), {}, token, headers);

// ── Usuarios y datos de referencia ──
const admin = await login("admin.petronorte");
const mgrNorte = await login("mgr.norte");
const mgrSur = await login("mgr.sur");
const cajNorte = await login("cajero.norte");
const cajSur = await login("cajero.sur");
const bomNorte = await login("bombero1.norte");
const bomSur = await login("bombero1.sur");
const T = {
  admin: admin.token, mgrNorte: mgrNorte.token, mgrSur: mgrSur.token,
  cajNorte: cajNorte.token, cajSur: cajSur.token, bomNorte: bomNorte.token, bomSur: bomSur.token,
};

const stationsRes = await gql(`{ gasStations { id name } }`, {}, T.admin);
if (stationsRes.errors) throw new Error(`gasStations: ${stationsRes.errors[0].message}`);
const stations = stationsRes.data.gasStations;
const NORTE = stations.find((s) => s.name === "Estación Norte");
const SUR = stations.find((s) => s.name === "Estación Sur");
const companyId = admin.user.company.id;

const ticketsNorte = (await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { id cashierShiftId fuelTypeId assignedSaleTypeConfigId status } }`, { id: NORTE.id }, T.admin)).data.salesTicketsByGasStation;
const ticketSur = (await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { id } }`, { id: SUR.id }, T.admin)).data.salesTicketsByGasStation[0];
const configSur = (await gql(`query($id: UUID!) { saleTypeConfigs(gasStationId: $id) { id } }`, { id: SUR.id }, T.admin)).data.saleTypeConfigs[0];
const shiftSur = (await gql(`query($id: UUID!) { employeeShiftsByGasStation(gasStationId: $id) { id employeeId } }`, { id: SUR.id }, T.admin)).data.employeeShiftsByGasStation[0];
const empNorteOwn = cajNorte.user.employeeProfile?.id;
const empSurOther = shiftSur?.employeeId;
const adminId = admin.user.id;

// Usuario administrativo para la fila 4 y 15-17 (no existe en el seed).
const admUsername = `adm.norte.${Date.now()}`;
const admCreate = await call(T.admin, "Mutation", "createUser", { username: admUsername, password: PASSWORD, role: "EMPLOYEE", userType: "Administrative", companyId, gasStationId: NORTE.id });
if (admCreate.errors) throw new Error(`crear administrativo: ${admCreate.errors[0].message}`);
const adm = await login(admUsername);
const supUsername = `sup.norte.${Date.now()}`;
const supCreate = await call(T.admin, "Mutation", "createUser", { username: supUsername, password: PASSWORD, role: "EMPLOYEE", userType: "Supervisor", companyId, gasStationId: NORTE.id });
if (supCreate.errors) throw new Error(`crear supervisor: ${supCreate.errors[0].message}`);
const sup = await login(supUsername);

console.log("\n== 1. Sin token: toda operación (salvo sesión) → UNAUTHENTICATED ==");
const PUBLIC = new Set(["login", "refreshSession", "logout"]);
let unauthBad = [];
for (const kind of ["Query", "Mutation"]) {
  for (const f of OPS[kind]) {
    if (PUBLIC.has(f.name)) continue;
    const r = await call(null, kind, f.name);
    if (codeOf(r) !== "UNAUTHENTICATED") unauthBad.push(`${kind}.${f.name}=${codeOf(r)}`);
  }
}
check(`todas las operaciones protegidas responden UNAUTHENTICATED sin token`, unauthBad.length === 0, unauthBad.join(", "));

console.log("\n== 2. Matriz de permisos (una comprobación por fila) ==");
const rows = [
  ["1 crear empleado: gerente de su estación", T.mgrNorte, "createUser", { role: "EMPLOYEE", gasStationId: NORTE.id, companyId, username: `emp.${Date.now()}`, password: PASSWORD, userType: "FuelAttendant" }, "OK"],
  ["1 crear empleado: cajero", T.cajNorte, "createUser", { role: "EMPLOYEE", gasStationId: NORTE.id, companyId }, "FORBIDDEN"],
  ["2 crear isla: admin", T.admin, "createPumpIsland", { gasStationId: NORTE.id }, "OK"],
  ["2 crear isla: gerente (👁)", T.mgrNorte, "createPumpIsland", { gasStationId: NORTE.id }, "FORBIDDEN"],
  ["2 leer islas: bombero", T.bomNorte, "pumpIslandsByGasStation", { gasStationId: NORTE.id }, "OK"],
  ["3 crear combustible: gerente", T.mgrNorte, "createFuelType", {}, "FORBIDDEN"],
  ["3 leer monedas: bombero", T.bomNorte, "currencies", {}, "OK"],
  ["4 tasa de cambio: gerente", T.mgrNorte, "updateCurrency", { id: FAKE_ID }, "OK"],
  ["4 tasa de cambio: supervisor (👁)", sup.token, "updateCurrency", { id: FAKE_ID }, "FORBIDDEN"],
  ["5 tipo de venta: gerente de su estación", T.mgrNorte, "createSaleTypeConfig", { gasStationId: NORTE.id }, "OK"],
  ["5 tipo de venta: cajero", T.cajNorte, "createSaleTypeConfig", { gasStationId: NORTE.id }, "FORBIDDEN"],
  ["6 abrir su propio turno: cajero", T.cajNorte, "createEmployeeShift", { employeeId: empNorteOwn, gasStationId: NORTE.id }, "OK"],
  ["6 abrir turno de otro: cajero", T.cajNorte, "createEmployeeShift", { employeeId: empSurOther, gasStationId: NORTE.id }, "FORBIDDEN"],
  ["6 cerrar su turno: administrativo", adm?.token, "endEmployeeShift", { id: FAKE_ID }, "FORBIDDEN"],
  ["7 cerrar turno de otro: bombero", T.bomNorte, "endEmployeeShift", { id: shiftSur?.id ?? FAKE_ID }, "FORBIDDEN"],
  ["7 cerrar turno de otro: supervisor (gerente)", T.mgrNorte, "endEmployeeShift", { id: FAKE_ID }, "OK"],
  ["8 lectura de boquilla: cajero", T.cajNorte, "createDispenserReading", { dispenserNozzleId: FAKE_ID, shiftId: FAKE_ID }, "OK"],
  ["8 lectura de boquilla: bombero", T.bomNorte, "createDispenserReading", { dispenserNozzleId: FAKE_ID, shiftId: FAKE_ID }, "FORBIDDEN"],
  ["9 emitir ticket: cajero", T.cajNorte, "createSalesTicket", { gasStationId: NORTE.id, cashierShiftId: FAKE_ID, fuelTypeId: FAKE_ID, assignedSaleTypeConfigId: FAKE_ID, requestedLiters: 1, ticketIssueTime: "2026-01-01T00:00:00.000Z" }, "OK"],
  ["9 emitir ticket: bombero", T.bomNorte, "createSalesTicket", { gasStationId: NORTE.id, cashierShiftId: FAKE_ID, fuelTypeId: FAKE_ID, assignedSaleTypeConfigId: FAKE_ID, requestedLiters: 1, ticketIssueTime: "2026-01-01T00:00:00.000Z" }, "FORBIDDEN"],
  ["10 cobrar ticket: cajero", T.cajNorte, "createPayments", { salesTicketId: FAKE_ID, paymentTime: "2026-01-01T00:00:00.000Z", payments: [] }, "OK"],
  ["10 cobrar ticket: administrativo", adm?.token, "createPayments", { salesTicketId: FAKE_ID, paymentTime: "2026-01-01T00:00:00.000Z", payments: [] }, "FORBIDDEN"],
  ["11 despachar ticket: bombero", T.bomNorte, "processSalesTicketDispatch", { id: FAKE_ID }, "OK"],
  ["11 despachar ticket: administrativo", adm?.token, "processSalesTicketDispatch", { id: FAKE_ID }, "FORBIDDEN"],
  ["12 cancelar ticket: supervisor", sup.token, "cancelSalesTicket", { id: FAKE_ID }, "OK"],
  ["12 cancelar ticket: cajero", T.cajNorte, "cancelSalesTicket", { id: FAKE_ID }, "FORBIDDEN"],
  ["13 devolución: cajero", T.cajNorte, "createTicketRefund", { salesTicketId: FAKE_ID }, "OK"],
  ["13 devolución: bombero", T.bomNorte, "createTicketRefund", { salesTicketId: FAKE_ID }, "FORBIDDEN"],
  ["14 medir tanque: bombero", T.bomNorte, "createTankMeasurement", { tankId: FAKE_ID }, "OK"],
  ["14 medir tanque: cajero", T.cajNorte, "createTankMeasurement", { tankId: FAKE_ID }, "FORBIDDEN"],
  ["15 factura de proveedor: administrativo", adm?.token, "createInvoice", { gasStationId: NORTE.id }, "OK"],
  ["15 factura de proveedor: supervisor (👁)", T.mgrNorte, "createInvoice", { gasStationId: NORTE.id }, "OK"],
  ["15 factura de proveedor: cajero", T.cajNorte, "createInvoice", { gasStationId: NORTE.id }, "FORBIDDEN"],
  ["16 descarga de combustible: supervisor", T.mgrNorte, "createDispatchReception", { invoiceId: FAKE_ID, tankId: FAKE_ID }, "OK"],
  ["16 descarga de combustible: cajero", T.cajNorte, "createDispatchReception", { invoiceId: FAKE_ID, tankId: FAKE_ID }, "FORBIDDEN"],
  ["17 pago a proveedor: administrativo", adm?.token, "createInvoicePayment", { invoiceId: FAKE_ID, recordedById: adminId }, "OK"],
  ["17 pago a proveedor: gerente (👁)", T.mgrNorte, "createInvoicePayment", { invoiceId: FAKE_ID, recordedById: adminId }, "FORBIDDEN"],
  ["18 auditoría de turnos: administrativo", adm?.token, "shiftAudit", { gasStationId: NORTE.id }, "OK"],
  ["18 auditoría de turnos: cajero", T.cajNorte, "shiftAudit", { gasStationId: NORTE.id }, "FORBIDDEN"],
  ["19 diferencial por bombero: cajero", T.cajNorte, "dispatcherDifferentialSummary", { gasStationId: NORTE.id }, "FORBIDDEN"],
  ["20 cerrar período de auditoría: gerente", T.mgrNorte, "createAuditPeriodClose", { input: undefined }, "OK"],
  ["20 borrar período de auditoría: gerente (solo admin)", T.mgrNorte, "deleteAuditPeriodClose", { id: FAKE_ID }, "FORBIDDEN"],
];
for (const [label, token, op, overrides, expected] of rows) {
  if (!token) { check(`${label} (sin usuario de prueba)`, false, "falta el usuario"); continue; }
  const cleaned = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
  let r = await call(token, op.startsWith("delete") || op.startsWith("update") || op.startsWith("end") || op.startsWith("cancel") || op.startsWith("process") ? "Mutation" : OPS.Query.some((f) => f.name === op) ? "Query" : "Mutation", op, cleaned);
  const got = denied(r) ? codeOf(r) : "OK";
  check(`${label}: ${op} → ${expected}`, expected === "OK" ? got !== "FORBIDDEN" && got !== "UNAUTHENTICATED" : got === expected, `obtuvo ${got}${r.errors ? ` (${r.errors[0].message})` : ""}`);
}

console.log("\n== 3. Alcance: el gerente de Norte no toca Sur ==");
const scopeSur = await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { id } }`, { id: SUR.id }, T.mgrNorte);
check("lista por estación Sur (gerente Norte) → FORBIDDEN", codeOf(scopeSur) === "FORBIDDEN", codeOf(scopeSur));
const scopeOne = await gql(`query($id: UUID!) { salesTicket(id: $id) { id } }`, { id: ticketSur.id }, T.mgrNorte);
check("ticket de Sur por id (gerente Norte) → FORBIDDEN", codeOf(scopeOne) === "FORBIDDEN", codeOf(scopeOne));
const scopeList = await gql(`{ salesTickets { id gasStationId } }`, {}, T.mgrNorte);
check("lista de tickets del gerente Norte solo tiene tickets de Norte", !scopeList.errors && scopeList.data.salesTickets.every((t) => t.gasStationId === NORTE.id), scopeList.errors?.[0]?.message);
const scopeCfg = await call(T.mgrNorte, "Mutation", "updateSaleTypeConfig", { id: configSur.id, input: {} });
check("actualizar tipo de venta de Sur (gerente Norte) → FORBIDDEN", codeOf(scopeCfg) === "FORBIDDEN", codeOf(scopeCfg));
const scopeCreate = await call(T.mgrNorte, "Mutation", "createSaleTypeConfig", { input: { gasStationId: SUR.id } });
check("crear tipo de venta en Sur (gerente Norte) → FORBIDDEN", codeOf(scopeCreate) === "FORBIDDEN", codeOf(scopeCreate));
const scopeStations = await gql(`{ gasStations { id } }`, {}, T.cajSur);
check("lista de estaciones (cajero Sur) solo incluye Sur", !scopeStations.errors && scopeStations.data.gasStations.every((s) => s.id === SUR.id), scopeStations.errors?.[0]?.message);
const scopeAdminSur = await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { id } }`, { id: SUR.id }, T.admin);
check("admin lee tickets de Sur (misma empresa) → OK", !scopeAdminSur.errors, scopeAdminSur.errors?.[0]?.message);

console.log("\n== 4. H-002: escalada de privilegios en usuarios ==");
const elevate = await call(T.cajNorte, "Mutation", "createUser", { role: "ADMIN", companyId, gasStationId: NORTE.id });
check("empleado no crea admin → FORBIDDEN", codeOf(elevate) === "FORBIDDEN", codeOf(elevate));
const mgrAdmin = await call(T.mgrNorte, "Mutation", "createUser", { role: "ADMIN", companyId, gasStationId: NORTE.id });
check("gerente no crea admin → FORBIDDEN", codeOf(mgrAdmin) === "FORBIDDEN", codeOf(mgrAdmin));
const mgrSurEmp = await call(T.mgrNorte, "Mutation", "createUser", { role: "EMPLOYEE", companyId, gasStationId: SUR.id });
check("gerente no crea empleado en Sur → FORBIDDEN", codeOf(mgrSurEmp) === "FORBIDDEN", codeOf(mgrSurEmp));
const mgrEditAdmin = await call(T.mgrNorte, "Mutation", "updateUser", { id: adminId, input: { role: "EMPLOYEE" } });
check("gerente no modifica al admin → FORBIDDEN", codeOf(mgrEditAdmin) === "FORBIDDEN", codeOf(mgrEditAdmin));
const selfRole = await call(T.bomNorte, "Mutation", "updateUser", { id: bomNorte.user.id, input: { role: "ADMIN" } });
check("empleado no cambia su propio rol → FORBIDDEN", codeOf(selfRole) === "FORBIDDEN", codeOf(selfRole));

console.log("\n== 5. Propio turno y diferencial del bombero ==");
const detailOther = await call(T.cajNorte, "Query", "shiftAuditDetail", { shiftId: shiftSur?.id ?? FAKE_ID });
check("cajero no ve auditoría de turno ajeno → FORBIDDEN", codeOf(detailOther) === "FORBIDDEN", codeOf(detailOther));
const detailMgr = await call(T.mgrNorte, "Query", "shiftAuditDetail", { shiftId: shiftSur?.id ?? FAKE_ID });
check("gerente Norte ve auditoría de turno de Sur → FORBIDDEN (alcance)", codeOf(detailMgr) === "FORBIDDEN", codeOf(detailMgr));
const diffBom = await gql(`query($s: UUID) { dispatcherDifferentialSummary(gasStationId: $s) { dispatcherEmployeeId } }`, { s: NORTE.id }, T.bomNorte);
const bomEmp = bomNorte.user.employeeProfile?.id;
check("bombero solo ve su fila en el diferencial por bombero", !diffBom.errors && diffBom.data.dispatcherDifferentialSummary.every((r) => r.dispatcherEmployeeId === bomEmp), diffBom.errors?.[0]?.message);

console.log("\n== 6. Idempotencia: rechazo antes de marcar APPLIED ==");
const K = crypto.randomUUID();
const shiftNorte = ticketsNorte[0];
const idemInput = { gasStationId: NORTE.id, cashierShiftId: shiftNorte.cashierShiftId, fuelTypeId: shiftNorte.fuelTypeId, assignedSaleTypeConfigId: shiftNorte.assignedSaleTypeConfigId, requestedLiters: 2, ticketIssueTime: new Date().toISOString() };
const CREATE = `mutation($input: CreateSalesTicketInput!) { createSalesTicket(input: $input) { id ticketNumber } }`;
const byBom = await gql(CREATE, { input: idemInput }, T.bomNorte, { "x-offline-mutation-id": K });
check("bombero con la clave → FORBIDDEN", codeOf(byBom) === "FORBIDDEN", codeOf(byBom));
const byCaj = await gql(CREATE, { input: idemInput }, T.cajNorte, { "x-offline-mutation-id": K });
check("cajero reintenta con la misma clave → se aplica", !byCaj.errors && !!byCaj.data?.createSalesTicket?.id, byCaj.errors?.[0]?.message);
const replay = await gql(CREATE, { input: idemInput }, T.cajNorte, { "x-offline-mutation-id": K });
check("reenvío con la misma clave devuelve el mismo ticket", replay.data?.createSalesTicket?.id === byCaj.data?.createSalesTicket?.id, replay.errors?.[0]?.message);

console.log("\n== 7. Sesión revocada ==");
const short = await login("bombero1.sur");
const before = await gql(`{ me { id } }`, {}, short.token);
check("token vigente funciona", !before.errors, before.errors?.[0]?.message);
await gql(`mutation($r: String!) { logout(refreshToken: $r) }`, { r: short.refreshToken }, null);
const after = await gql(`{ me { id } }`, {}, short.token);
check("tras logout el mismo token → UNAUTHENTICATED", codeOf(after) === "UNAUTHENTICATED", codeOf(after));

console.log(`\n${passes} OK · ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);
