// Pruebas puras de la licencia CCI1: firma Ed25519 y umbrales de estado (T-050). Sin red ni BD.
// Uso: node --loader ts-node/esm --experimental-specifier-resolution=node scripts/test-license-lifecycle.ts
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyCciLicense } from "../src/license/cciLicense";
import { computeStatus, createDebouncer, effectiveNow, isClockSkewed, maxDate } from "../src/license/lifecycle";
import { isHardRejection } from "../src/license/service";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function makeToken(payload: Record<string, unknown>, key = privateKey): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const text = `CCI1.${body}`;
  const sig = sign(null, Buffer.from(text, "ascii"), key).toString("base64url");
  return `${text}.${sig}`;
}

const DAY = 86_400_000;
const now = new Date("2026-10-08T00:00:00.000Z");
// T-058: payload v2 (contrato v2 de cci-licensing) — "limits"/"authorized" en vez de
// "maxStations", y "trial".
const base = {
  v: 2,
  kid: "test",
  customerId: "c1",
  customerName: "Demo C.A.",
  instanceId: "i1",
  product: "fueltrack",
  plan: "CHAIN",
  modality: "SAAS" as const,
  fingerprint: "fp-test",
  graceDays: 7,
  trial: false,
  limits: { stations: 3 },
  authorized: { stations: ["s1", "s2", "s3"] },
  issuedAt: now.toISOString(),
};

// 1. Firma válida.
const validToken = makeToken({ ...base, expiresAt: new Date(now.getTime() + 30 * DAY).toISOString() });
const validPayload = verifyCciLicense(validToken, publicKeyPem);
check("firma válida verifica y devuelve el payload", validPayload?.customerId === "c1");

// 2. Firma alterada: cambiar la firma sin tocar el payload.
const [prefix, body, sig] = validToken.split(".");
check("firma reemplazada por basura no verifica", verifyCciLicense(`${prefix}.${body}.${"A".repeat(86)}`, publicKeyPem) === null);

// 3. Payload alterado conservando la firma original (simula editar limits.stations a mano).
const tamperedBody = Buffer.from(JSON.stringify({ ...base, limits: { stations: 999 }, expiresAt: base.issuedAt })).toString("base64url");
check("payload alterado con la firma de otro payload no verifica", verifyCciLicense(`CCI1.${tamperedBody}.${sig}`, publicKeyPem) === null);

// 4. Clave pública equivocada (otra instancia o configuración incorrecta).
const other = generateKeyPairSync("ed25519");
const otherPem = other.publicKey.export({ type: "spki", format: "pem" }).toString();
check("verificación con la clave pública equivocada falla", verifyCciLicense(validToken, otherPem) === null);

// 5. Formato inválido.
check("token sin tres partes no verifica", verifyCciLicense("CCI1.solo-dos-partes", publicKeyPem) === null);
check("prefijo distinto de CCI1 no verifica", verifyCciLicense(`XXXX.${body}.${sig}`, publicKeyPem) === null);

// 5b. T-058, corte limpio: una licencia "v: 1", aunque la firma sea válida, ya no se acepta.
const v1Token = makeToken({ ...base, v: 1, maxStations: 3, expiresAt: new Date(now.getTime() + 30 * DAY).toISOString() });
check("licencia v:1 con firma válida no verifica (corte limpio v1 -> v2)", verifyCciLicense(v1Token, publicKeyPem) === null);

// 6. Umbrales de estado (mismo criterio que cci-licensing/src/lifecycle/lifecycle.ts).
const statusOf = (expiresInDays: number) => {
  const token = makeToken({ ...base, expiresAt: new Date(now.getTime() + expiresInDays * DAY).toISOString() });
  const payload = verifyCciLicense(token, publicKeyPem)!;
  return computeStatus(new Date(payload.expiresAt), payload.graceDays, now);
};
check("vence en 30 días -> ACTIVE", statusOf(30) === "ACTIVE");
check("vence en 3 días -> DUE_SOON", statusOf(3) === "DUE_SOON");
check("vence hoy -> DUE_SOON", statusOf(0) === "DUE_SOON");
check("vencida hace 3 días (gracia de 7) -> GRACE", statusOf(-3) === "GRACE");
check("vencida hace exactamente 7 días (gracia de 7) -> GRACE", statusOf(-7) === "GRACE");
check("vencida hace 10 días (gracia de 7) -> READ_ONLY", statusOf(-10) === "READ_ONLY");

// 6b. T-058: una prueba gratis tiene graceDays=0 (sin período de gracia) — pasa de DUE_SOON
// directo a READ_ONLY al llegar a expiresAt, nunca GRACE.
const trialStatusOf = (expiresInDays: number) => {
  const token = makeToken({ ...base, trial: true, graceDays: 0, limits: { stations: 1 }, authorized: { stations: ["s1"] }, expiresAt: new Date(now.getTime() + expiresInDays * DAY).toISOString() });
  const payload = verifyCciLicense(token, publicKeyPem)!;
  return computeStatus(new Date(payload.expiresAt), payload.graceDays, now);
};
check("prueba gratis, vence en 3 días -> DUE_SOON", trialStatusOf(3) === "DUE_SOON");
check("prueba gratis, vencida hace 2 días (sin gracia) -> READ_ONLY, nunca GRACE", trialStatusOf(-2) === "READ_ONLY");

// 7. T-053: atrasar el reloj no rejuvenece la licencia; CREDENTIAL_REQUIRED y un 5xx no fuerzan
// solo lectura.
check("maxDate elige la fecha más alta entre varias, ignorando undefined/null", maxDate(undefined, null, new Date(now.getTime() - DAY), new Date(now.getTime() + DAY)).getTime() === now.getTime() + DAY);
check("maxDate sin ninguna fecha da la época unix", maxDate(undefined, null).getTime() === 0);

check("effectiveNow usa el reloj local si va adelante de maxSeenAt", effectiveNow(new Date(now.getTime() + DAY), new Date(now.getTime())).getTime() === now.getTime() + DAY);
check("effectiveNow usa maxSeenAt si el reloj local está atrasado", effectiveNow(new Date(now.getTime() - 30 * DAY), new Date(now.getTime())).getTime() === now.getTime());

check("desfase de minutos no activa clockSkewDetected", !isClockSkewed(now, new Date(now.getTime() + 10 * 60 * 1000)));
check("desfase de exactamente 24h no activa clockSkewDetected (el límite es 'más de')", !isClockSkewed(now, new Date(now.getTime() + 24 * 60 * 60 * 1000)));
check("desfase de más de 24h activa clockSkewDetected", isClockSkewed(now, new Date(now.getTime() + 25 * 60 * 60 * 1000)));

// Escenario del criterio: licencia que vence mañana, con maxSeenAt ya adelantado 40 días (se vio
// pasar ese tiempo antes de que alguien atrasara el reloj) y el reloj local retrocedido a medio
// día después de emitida. No debe volver a ACTIVE ni a DUE_SOON: el avance ya visto manda.
{
  const issuedAt = now;
  const expiresAt = new Date(now.getTime() + DAY); // vence "mañana"
  const maxSeenAt = new Date(now.getTime() + 40 * DAY); // ya se vio pasar ese tiempo
  const rolledBackClock = new Date(now.getTime() + 12 * 60 * 60 * 1000); // reloj atrasado a medio día tras emitida
  const status = computeStatus(expiresAt, 7, effectiveNow(rolledBackClock, maxSeenAt));
  check("reloj atrasado tras ver pasar 40 días -> no vuelve a ACTIVE/DUE_SOON (READ_ONLY)", status === "READ_ONLY");
  void issuedAt;
}

check("CREDENTIAL_REQUIRED no es un rechazo duro (no fuerza solo lectura)", !isHardRejection("CREDENTIAL_REQUIRED"));
check("un 5xx sin código reconocido no es un rechazo duro", !isHardRejection(undefined));
check("INVALID_LICENSE sí es un rechazo duro", isHardRejection("INVALID_LICENSE"));
check("SUBSCRIPTION_CANCELED sí es un rechazo duro", isHardRejection("SUBSCRIPTION_CANCELED"));
// T-058: SUBSCRIPTION_SUSPENDED fuerza solo lectura igual que CANCELED; INVALID_USAGE es un error
// de FuelTrack (informe mal formado), nunca fuerza solo lectura.
check("SUBSCRIPTION_SUSPENDED sí es un rechazo duro", isHardRejection("SUBSCRIPTION_SUSPENDED"));
check("INVALID_USAGE no es un rechazo duro (no fuerza solo lectura)", !isHardRejection("INVALID_USAGE"));

// 8. T-055: createDebouncer (usado por scheduleImmediateRevalidation tras desactivar/reactivar
// una estación). Delays cortos: no hace falta mockear el reloj.
{
  const calls: number[] = [];
  const debouncer = createDebouncer<number>((arg) => calls.push(arg), 60);
  debouncer.trigger(1);
  debouncer.trigger(2);
  debouncer.trigger(3); // tres llamadas seguidas, antes de que venza el antirrebote
  check("antirrebote: nada corre todavía mientras está pendiente", calls.length === 0 && debouncer.pending);
  await new Promise((r) => setTimeout(r, 120));
  check("antirrebote: se ejecuta una sola vez, con el último argumento", calls.length === 1 && calls[0] === 3);
  check("antirrebote: callCount queda en 1", debouncer.callCount === 1);

  debouncer.trigger(4);
  await new Promise((r) => setTimeout(r, 120));
  check("antirrebote: una llamada posterior (ya sin pendiente) dispara de nuevo", calls.length === 2 && calls[1] === 4);
}

console.log(`\n${failures === 0 ? "todas las comprobaciones pasaron" : `${failures} comprobación(es) fallaron`}`);
process.exit(failures > 0 ? 1 : 0);
