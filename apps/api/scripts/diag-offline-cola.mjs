// Reproduce el envío de la cola offline de station (flujo del cajero) con los headers x-offline-*.
// Por usuario imprime cada operación con su resultado. Uso:
//   API_URL=http://localhost:4000/graphql node scripts/diag-offline-cola.mjs
// Contraseña de los usuarios demo: Demo1234!

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";
const PASSWORD = "Demo1234!";

async function gql(query, variables = {}, token, headers = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const resultOf = (r) => (r.errors ? r.errors[0]?.extensions?.code ?? "ERROR_NEGOCIO" : "OK");

async function login(username) {
  const r = await gql(`mutation($u: String!, $p: String!) { login(input: { username: $u, password: $p }) { token user { id company { id } employeeProfile { id } } } }`, { u: username, p: PASSWORD });
  if (r.errors) throw new Error(`login ${username}: ${r.errors[0].message}`);
  return r.data.login;
}

const admin = await login("admin.petronorte");
const station = (await gql(`{ gasStations { id name } }`, {}, admin.token)).data.gasStations.find((s) => s.name === "Estación Norte");
const dispensers = (await gql(`query($id: UUID!) { dispensersByGasStation(gasStationId: $id) { id } }`, { id: station.id }, admin.token)).data.dispensersByGasStation;
const nozzle = (await gql(`query($id: UUID!) { dispenserNozzlesByDispenser(dispenserId: $id) { id } }`, { id: dispensers[0].id }, admin.token)).data.dispenserNozzlesByDispenser[0];
const tank = (await gql(`query($id: UUID!) { tanksByGasStation(gasStationId: $id) { id } }`, { id: station.id }, admin.token)).data.tanksByGasStation[0];
const seedTicket = (await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { cashierShiftId fuelTypeId assignedSaleTypeConfigId } }`, { id: station.id }, admin.token)).data.salesTicketsByGasStation[0];
const usd = (await gql(`{ currencies { id exchangeRate } }`, {}, admin.token)).data.currencies.find((c) => c.exchangeRate === 1);

const MUT = {
  shift: `mutation($input: CreateEmployeeShiftInput!) { createEmployeeShift(input: $input) { id } }`,
  reading: `mutation($input: CreateDispenserReadingInput!) { createDispenserReading(input: $input) { id } }`,
  ticket: `mutation($input: CreateSalesTicketInput!) { createSalesTicket(input: $input) { id } }`,
  pay: `mutation($id: UUID!, $lines: [PaymentLineInput!]!) { createPayments(salesTicketId: $id, paymentTime: "2026-10-06T12:00:00.000Z", payments: $lines) { id } }`,
  dispatch: `mutation($id: UUID!, $e: UUID!, $n: UUID!, $l: Decimal!) { processSalesTicketDispatch(id: $id, dispatcherEmployeeId: $e, dispenserNozzleId: $n, actualLitersDispatched: $l) { id } }`,
  measure: `mutation($input: CreateTankMeasurementInput!) { createTankMeasurement(input: $input) { id } }`,
  endShift: `mutation($id: UUID!, $t: DateTime!) { endEmployeeShift(id: $id, shiftEndTime: $t) { id } }`,
};

async function runFlow(username) {
  const u = await login(username);
  const emp = u.user.employeeProfile?.id;
  const headers = (kind) => ({
    "x-offline-created-by": username,
    "x-offline-device-fp": "diag-t046",
    "x-offline-queued-at": new Date().toISOString(),
    "x-offline-mutation-id": crypto.randomUUID(),
  });
  console.log(`\n== ${username} ==`);
  const rows = [];
  const step = async (name, query, variables) => {
    const r = await gql(query, variables, u.token, headers(name));
    rows.push([name, resultOf(r), r.errors?.[0]?.message ?? ""]);
    return r.data;
  };
  const shiftData = await step("abrir turno", MUT.shift, { input: { employeeId: emp, gasStationId: station.id, shiftStartTime: new Date().toISOString(), employeeRole: "CASHIER" } });
  const shiftId = shiftData?.createEmployeeShift?.id ?? seedTicket.cashierShiftId;
  await step("lectura INITIAL", MUT.reading, { input: { dispenserNozzleId: nozzle.id, employeeShiftId: shiftId, readingTime: new Date().toISOString(), meterReading: 100, readingType: "INITIAL" } });
  const tk = (await step("emitir ticket", MUT.ticket, { input: { gasStationId: station.id, cashierShiftId: shiftId, fuelTypeId: seedTicket.fuelTypeId, requestedLiters: 3, assignedSaleTypeConfigId: seedTicket.assignedSaleTypeConfigId, ticketIssueTime: new Date().toISOString() } }))?.createSalesTicket;
  if (tk) {
    await step("cobrar", MUT.pay, { id: tk.id, lines: [{ paymentMethod: "CASH", amount: 1.95, currencyId: usd.id }] });
    await step("despachar", MUT.dispatch, { id: tk.id, e: emp ?? seedTicket.cashierShiftId, n: nozzle.id, l: 3 });
  }
  await step("medición de tanque", MUT.measure, { input: { tankId: tank.id, employeeId: emp ?? seedTicket.cashierShiftId, employeeShiftId: shiftId, measurementTime: new Date().toISOString(), manualLevelReadingCm: 50, volumeInLiters: 100, measurementReason: "SHIFT_CLOSURE" } });
  await step("lectura FINAL", MUT.reading, { input: { dispenserNozzleId: nozzle.id, employeeShiftId: shiftId, readingTime: new Date().toISOString(), meterReading: 103, readingType: "FINAL" } });
  if (shiftData?.createEmployeeShift) await step("cerrar turno", MUT.endShift, { id: shiftId, t: new Date().toISOString() });
  console.table(rows.map(([op, res, msg]) => ({ operacion: op, resultado: res, mensaje: msg.slice(0, 90) })));
}

await runFlow("cajero.norte");
await runFlow("bombero1.norte");

// CSRF de Apollo: una petición sin content-type JSON ni cabecera de preflight.
const csrf = await fetch(API_URL, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ query: "{ __typename }" }) });
console.log(`\nCSRF (text/plain sin preflight) -> HTTP ${csrf.status}: ${(await csrf.text()).slice(0, 120)}`);
