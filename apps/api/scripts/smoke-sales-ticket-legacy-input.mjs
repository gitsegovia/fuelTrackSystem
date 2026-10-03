// Smoke test T-034: los campos legados de SalesTicket (totalAmountExpected, status, despacho)
// se aceptan y el servidor los ignora. Requiere la API arriba y el seed cargado.
// Uso: API_URL=http://localhost:4000/graphql ADMIN_USER=... ADMIN_PASS=... node scripts/smoke-sales-ticket-legacy-input.mjs

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";
const USER = process.env.ADMIN_USER ?? "admin.petronorte";
const PASS = process.env.ADMIN_PASS ?? "Demo1234!";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
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

const token = (await gql(`mutation($u: String!, $p: String!) { login(input: { username: $u, password: $p }) { token } }`, { u: USER, p: PASS })).data.login.token;
const stations = (await gql(`{ gasStations { id name } }`, {}, token)).data.gasStations;
const station = stations[0];
const seedTicket = (await gql(`query($id: UUID!) { salesTicketsByGasStation(gasStationId: $id) { cashierShiftId fuelTypeId assignedSaleTypeConfigId } }`, { id: station.id }, token)).data.salesTicketsByGasStation[0];
const stc = (await gql(`query($id: UUID!) { saleTypeConfig(id: $id) { salePricePerLiter } }`, { id: seedTicket.assignedSaleTypeConfigId }, token)).data.saleTypeConfig;
const price = Number(stc.salePricePerLiter);

const CREATE = `mutation($input: CreateSalesTicketInput!) { createSalesTicket(input: $input) { id status paymentMode pricePerLiter totalAmountExpected requestedLiters } }`;
const UPDATE = `mutation($id: UUID!, $input: UpdateSalesTicketInput!) { updateSalesTicket(id: $id, input: $input) { id status requestedLiters totalAmountExpected } }`;

const legacyCreate = {
  gasStationId: station.id,
  cashierShiftId: seedTicket.cashierShiftId,
  fuelTypeId: seedTicket.fuelTypeId,
  requestedLiters: 10,
  assignedSaleTypeConfigId: seedTicket.assignedSaleTypeConfigId,
  ticketIssueTime: new Date().toISOString(),
  totalAmountExpected: 999,
  status: "COMPLETED",
  actualLitersDispatched: 3,
  dispatcherEmployeeId: seedTicket.cashierShiftId,
};

const created = await gql(CREATE, { input: legacyCreate }, token);
check("createSalesTicket acepta el input legado", !created.errors, created.errors?.[0]?.message);
const t = created.data?.createSalesTicket;
if (t) {
  check("total calculado por el servidor (requestedLiters × precio)", Math.abs(Number(t.totalAmountExpected) - 10 * price) < 0.005, `total=${t.totalAmountExpected}, esperado=${(10 * price).toFixed(2)}`);
  check("status ignorado: queda ISSUED", t.status === "ISSUED", `status=${t.status}`);
  check("paymentMode por defecto PREPAID", t.paymentMode === "PREPAID", `paymentMode=${t.paymentMode}`);

  const upd = await gql(UPDATE, { id: t.id, input: { status: "COMPLETED", totalAmountExpected: 1, actualLitersDispatched: 2, requestedLiters: 4 } }, token);
  check("updateSalesTicket acepta campos legados", !upd.errors, upd.errors?.[0]?.message);
  const u = upd.data?.updateSalesTicket;
  if (u) {
    check("update: status legado ignorado", u.status === "ISSUED", `status=${u.status}`);
    check("update: total recalculado con los litros nuevos", Math.abs(Number(u.totalAmountExpected) - 4 * price) < 0.005, `total=${u.totalAmountExpected}`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} comprobación(es) fallaron`);
  process.exit(1);
}
console.log("\ntodas las comprobaciones pasaron");
