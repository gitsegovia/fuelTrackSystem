// Pruebas puras de la licencia CCI1: firma Ed25519 y umbrales de estado (T-050). Sin red ni BD.
// Uso: node --loader ts-node/esm --experimental-specifier-resolution=node scripts/test-license-lifecycle.ts
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyCciLicense } from "../src/license/cciLicense";
import { computeStatus } from "../src/license/lifecycle";

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
const base = {
  v: 1,
  kid: "test",
  customerId: "c1",
  customerName: "Demo C.A.",
  instanceId: "i1",
  product: "fueltrack",
  plan: "CHAIN",
  maxStations: 3,
  modality: "SAAS" as const,
  fingerprint: "fp-test",
  graceDays: 7,
  issuedAt: now.toISOString(),
};

// 1. Firma válida.
const validToken = makeToken({ ...base, expiresAt: new Date(now.getTime() + 30 * DAY).toISOString() });
const validPayload = verifyCciLicense(validToken, publicKeyPem);
check("firma válida verifica y devuelve el payload", validPayload?.customerId === "c1");

// 2. Firma alterada: cambiar la firma sin tocar el payload.
const [prefix, body, sig] = validToken.split(".");
check("firma reemplazada por basura no verifica", verifyCciLicense(`${prefix}.${body}.${"A".repeat(86)}`, publicKeyPem) === null);

// 3. Payload alterado conservando la firma original (simula editar maxStations a mano).
const tamperedBody = Buffer.from(JSON.stringify({ ...base, maxStations: 999, expiresAt: base.issuedAt })).toString("base64url");
check("payload alterado con la firma de otro payload no verifica", verifyCciLicense(`CCI1.${tamperedBody}.${sig}`, publicKeyPem) === null);

// 4. Clave pública equivocada (otra instancia o configuración incorrecta).
const other = generateKeyPairSync("ed25519");
const otherPem = other.publicKey.export({ type: "spki", format: "pem" }).toString();
check("verificación con la clave pública equivocada falla", verifyCciLicense(validToken, otherPem) === null);

// 5. Formato inválido.
check("token sin tres partes no verifica", verifyCciLicense("CCI1.solo-dos-partes", publicKeyPem) === null);
check("prefijo distinto de CCI1 no verifica", verifyCciLicense(`XXXX.${body}.${sig}`, publicKeyPem) === null);

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

console.log(`\n${failures === 0 ? "todas las comprobaciones pasaron" : `${failures} comprobación(es) fallaron`}`);
process.exit(failures > 0 ? 1 : 0);
