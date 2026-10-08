import axios from "axios";
import fs from "fs/promises";
import { GraphQLError } from "graphql";
import { AppModels } from "../interfaces/models";
import { validateLicense as validateLegacyLicense } from "../utils/licenseValidator";
import { CciLicensePayload, verifyCciLicense } from "./cciLicense";
import { computeStatus, daysUntil, graceEndsAt, LicenseStatus } from "./lifecycle";

// Fila única: no hace falta buscarla por ningún criterio de negocio.
const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";
const DAY_MS = 24 * 60 * 60 * 1000;
// Rechazos explícitos del servidor: prevalecen sobre la fecha local hasta la próxima validación
// exitosa (a diferencia de un error de red, que conserva el último estado bueno conocido).
const HARD_REJECTIONS = new Set(["INVALID_LICENSE", "INSTANCE_NOT_FOUND", "FINGERPRINT_MISMATCH", "SUBSCRIPTION_CANCELED"]);

export interface LicenseSnapshot {
  mode: "CCI1" | "LEGACY";
  status: LicenseStatus | null;
  plan: string | null;
  maxStations: number | null;
  activeStations: number;
  expiresAt: Date | null;
  graceEndsAt: Date | null;
  daysRemaining: number | null;
  readOnly: boolean;
  customerName: string | null;
  lastValidatedAt: Date | null;
}

let publicKeyPem: string | null = null;

async function loadPublicKey(): Promise<string | null> {
  const inline = process.env.LICENSE_PUBLIC_KEY;
  if (inline) return inline.replace(/\\n/g, "\n");
  const path = process.env.LICENSE_PUBLIC_KEY_PATH;
  if (!path) return null;
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

// Modo CCI1 solo si hay clave pública configurada; si no, se sigue usando la validación vieja
// (CCILicenseServer) sin ningún cambio de comportamiento — así el demo, el stack de verificación
// y el CI no necesitan tocar nada.
export function isCciMode(): boolean {
  return !!publicKeyPem;
}

// El fingerprint no cambia durante la vida del proceso (lo fija el entrypoint al instalar), así
// que se lee una sola vez y se cachea: no tiene sentido abrir el archivo en cada mutation.
let cachedFingerprint: string | null = null;

async function getFingerprint(): Promise<string> {
  if (cachedFingerprint === null) {
    const path = process.env.FINGERPRINT_PATH || "/etc/fueltrack/fingerprint";
    cachedFingerprint = (await fs.readFile(path, "utf8")).trim();
  }
  return cachedFingerprint;
}

async function countActiveStations(models: AppModels): Promise<number> {
  return models.GasStation.count();
}

// Verifica SIEMPRE con la clave pública local, tanto si el token viene de la red como si viene
// guardado en la BD: la firma es la raíz de confianza, no el canal por el que llegó. Además de la
// firma, exige que la licencia sea de esta instalación (`fingerprint`) y de este producto: sin
// esto, la fila de `license_states` de otra instancia (con firma válida pero de otro fingerprint)
// se aceptaría igual si se copiara a mano y se cortara la red hacia el servidor de licencias.
async function verifiedPayload(token: string | null): Promise<CciLicensePayload | null> {
  if (!token || !publicKeyPem) return null;
  const payload = verifyCciLicense(token, publicKeyPem);
  if (!payload) return null;
  if (payload.product !== "fueltrack") return null;
  if (payload.fingerprint !== (await getFingerprint())) return null;
  return payload;
}

export async function fetchAndStore(models: AppModels): Promise<void> {
  const row = await models.LicenseState.findByPk(SINGLETON_ID);
  const licenseServerUrl = process.env.LICENSE_SERVER_URL;
  const licenseKey = process.env.LICENSE_KEY;
  const fingerprint = await getFingerprint();
  const activeStations = await countActiveStations(models);
  const version = process.env.npm_package_version ?? "1.0.0";

  // Mismo registro que usa el rechazo explícito del servidor (HARD_REJECTIONS): no es un
  // problema de red, así que fuerza solo lectura ya, sin esperar a que venza la fecha local.
  const forceReadOnly = (lastError: string) =>
    models.LicenseState.upsert({
      id: SINGLETON_ID,
      licenseToken: row?.licenseToken ?? null,
      payload: row?.payload ?? null,
      serverStatus: "READ_ONLY",
      graceEndsAt: row?.graceEndsAt ?? null,
      activeStations,
      lastValidatedAt: new Date(),
      lastError,
    });

  const body: Record<string, unknown> = { fingerprint, activeStations, version };
  if (row?.licenseToken) body.license = row.licenseToken;
  else if (licenseKey) body.licenseKey = licenseKey;
  else throw new Error("Falta LICENSE_KEY y no hay ninguna licencia guardada todavía.");

  try {
    const { data } = await axios.post(`${licenseServerUrl}/v1/licenses/validate`, body, { timeout: 8000 });
    const token = data.license as string;
    const rawPayload = publicKeyPem ? verifyCciLicense(token, publicKeyPem) : null;
    if (!rawPayload) {
      throw new Error("La licencia recibida no verifica contra la clave pública configurada.");
    }
    if (rawPayload.product !== "fueltrack" || rawPayload.fingerprint !== fingerprint) {
      // No es de esta instalación o de este producto: se trata como sin licencia (READ_ONLY),
      // no como un problema de red que deba conservar lo guardado.
      await forceReadOnly(
        `la licencia recibida no es de esta instalación (product=${rawPayload.product}, fingerprint=${rawPayload.fingerprint})`
      );
      return;
    }
    await models.LicenseState.upsert({
      id: SINGLETON_ID,
      licenseToken: token,
      payload: rawPayload as unknown as Record<string, unknown>,
      serverStatus: typeof data.status === "string" ? data.status : null,
      graceEndsAt: data.graceEndsAt ? new Date(data.graceEndsAt) : graceEndsAt(new Date(rawPayload.expiresAt), rawPayload.graceDays),
      activeStations,
      lastValidatedAt: new Date(),
      lastError: null,
    });
  } catch (error: any) {
    const code = error.response?.data?.code;
    if (code && HARD_REJECTIONS.has(code)) {
      // El servidor rechaza la licencia activamente (no es un problema de red).
      await forceReadOnly(`${code}: ${error.response?.data?.message ?? error.message}`);
      return;
    }
    // Sin red u otro error transitorio: se conserva la última licencia guardada y se sigue
    // operando con la fecha local (criterio "arranque sin red con la licencia guardada").
    console.warn("[licencia] no se pudo validar contra CCI Licencias, se sigue con lo guardado:", error.message);
    if (row) await row.update({ lastError: error.message });
  }
}

export async function getSnapshot(models: AppModels): Promise<LicenseSnapshot> {
  const activeStations = await countActiveStations(models);
  const base = {
    activeStations,
    plan: null,
    maxStations: null,
    expiresAt: null,
    graceEndsAt: null,
    daysRemaining: null,
    customerName: null,
    lastValidatedAt: null,
  };

  if (!isCciMode()) {
    return { mode: "LEGACY", status: null, readOnly: false, ...base };
  }

  const row = await models.LicenseState.findByPk(SINGLETON_ID);
  const payload = await verifiedPayload(row?.licenseToken ?? null);
  if (!payload) {
    return { mode: "CCI1", status: "READ_ONLY", readOnly: true, ...base, lastValidatedAt: row?.lastValidatedAt ?? null };
  }

  const now = new Date();
  const expiresAt = new Date(payload.expiresAt);
  let status = computeStatus(expiresAt, payload.graceDays, now);
  if (row!.serverStatus === "READ_ONLY") status = "READ_ONLY"; // rechazo explícito del servidor prevalece

  return {
    mode: "CCI1",
    status,
    readOnly: status === "READ_ONLY",
    activeStations,
    plan: payload.plan,
    maxStations: payload.maxStations,
    expiresAt,
    graceEndsAt: graceEndsAt(expiresAt, payload.graceDays),
    daysRemaining: daysUntil(expiresAt, now),
    customerName: payload.customerName,
    lastValidatedAt: row!.lastValidatedAt,
  };
}

export async function assertWritable(models: AppModels): Promise<void> {
  const snapshot = await getSnapshot(models);
  if (snapshot.readOnly) {
    throw new GraphQLError(
      "La licencia venció y pasó el período de gracia: la instalación opera en solo lectura.",
      { extensions: { code: "LICENSE_READ_ONLY" } }
    );
  }
}

export async function assertStationLimit(models: AppModels): Promise<void> {
  const snapshot = await getSnapshot(models);
  if (snapshot.maxStations != null && snapshot.activeStations >= snapshot.maxStations) {
    throw new GraphQLError(
      `La licencia permite hasta ${snapshot.maxStations} estación(es); ya hay ${snapshot.activeStations}.`,
      { extensions: { code: "LICENSE_STATION_LIMIT" } }
    );
  }
}

export function startDailyRevalidation(models: AppModels): void {
  if (!isCciMode()) return;
  setInterval(() => {
    fetchAndStore(models).catch((e) => console.warn("[licencia] revalidación diaria falló:", e.message));
  }, DAY_MS);
}

// Arranque: decide el modo, intenta validar en vivo (con tope de tiempo corto) y devuelve si la
// instalación tiene una licencia usable para arrancar. En modo CCI1 "usable" incluye READ_ONLY
// (la API arranca, solo que las mutations quedan bloqueadas); en modo legado es la validación
// binaria de siempre.
export async function bootLicense(models: AppModels): Promise<boolean> {
  publicKeyPem = await loadPublicKey();

  if (!isCciMode()) {
    return validateLegacyLicense();
  }

  await fetchAndStore(models).catch((e) => console.warn("[licencia] validación inicial falló:", e.message));
  const row = await models.LicenseState.findByPk(SINGLETON_ID);
  return (await verifiedPayload(row?.licenseToken ?? null)) !== null;
}
