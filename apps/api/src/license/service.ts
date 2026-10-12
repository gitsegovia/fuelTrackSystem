import axios from "axios";
import fs from "fs/promises";
import { GraphQLError } from "graphql";
import { AppModels } from "../interfaces/models";
import { validateLicense as validateLegacyLicense } from "../utils/licenseValidator";
import { CciLicensePayload, verifyCciLicense } from "./cciLicense";
import { clampLabel, computeStatus, createDebouncer, daysUntil, effectiveNow, graceEndsAt, isClockSkewed, maxDate, LicenseStatus } from "./lifecycle";

// Fila única: no hace falta buscarla por ningún criterio de negocio.
const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Rechazos explícitos del servidor: prevalecen sobre la fecha local hasta la próxima validación
// exitosa (a diferencia de un error de red, que conserva el último estado bueno conocido).
// CREDENTIAL_REQUIRED (falta configuración) y un 5xx sin código reconocido caen fuera de este
// conjunto a propósito: no son un rechazo de la licencia, así que no deben forzar solo lectura
// (pedido explícito de lic-core; ver test-license-lifecycle.ts).
// T-058: SUBSCRIPTION_SUSPENDED (suspensión manual del operador) fuerza solo lectura igual que
// SUBSCRIPTION_CANCELED. INVALID_USAGE queda fuera a propósito: es un error de FuelTrack (un
// informe de uso mal formado), no un rechazo de la licencia — se registra como error pero la
// instalación sigue operando con lo último guardado (ver el catch de fetchAndStore).
const HARD_REJECTIONS = new Set([
  "INVALID_LICENSE",
  "INSTANCE_NOT_FOUND",
  "FINGERPRINT_MISMATCH",
  "SUBSCRIPTION_CANCELED",
  "SUBSCRIPTION_SUSPENDED",
]);

export function isHardRejection(code: string | undefined | null): boolean {
  return !!code && HARD_REJECTIONS.has(code);
}

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
  clockSkewDetected: boolean;
  // T-058 (contrato v2): prueba gratis vigente, y las estaciones autorizadas/no autorizadas por
  // la clave "stations" de la licencia (ADR-012 de cci-licensing).
  trial: boolean;
  authorizedStationIds: string[];
  unauthorizedStationIds: string[];
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

// Para scripts de servidor (reactivate-station.ts) que necesitan isCciMode()/getSnapshot() sin
// levantar el servidor GraphQL completo ni hacer la validación en vivo que hace bootLicense.
export async function initLicenseKey(): Promise<void> {
  publicKeyPem = await loadPublicKey();
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

// T-058: orden por `createdAt` ascendente (recomendado por el contrato v2 para que la primera
// validación adopte las estaciones más antiguas primero). Única fuente para el conteo y para el
// informe de uso: nunca truncada ni paginada, para que el informe sea siempre completo.
async function listActiveStations(models: AppModels): Promise<Array<{ id: string; name: string }>> {
  const rows = await models.GasStation.findAll({
    where: { active: true },
    order: [["createdAt", "ASC"]],
    attributes: ["id", "name"],
    raw: true,
  });
  return rows as unknown as Array<{ id: string; name: string }>;
}

async function listActiveStationIds(models: AppModels): Promise<string[]> {
  return (await listActiveStations(models)).map((s) => s.id);
}

// T-062 (nombres opcionales): el nombre de la instancia por defecto es el de la primera empresa
// conocida — en la práctica una instalación tiene una sola empresa cliente. `LICENSE_INSTANCE_LABEL`
// manda si está configurada.
async function defaultInstanceLabel(models: AppModels): Promise<string | null> {
  const env = process.env.LICENSE_INSTANCE_LABEL;
  if (env) return env;
  const company = await models.Company.findOne({ order: [["createdAt", "ASC"]], attributes: ["name"] });
  return company?.name ?? null;
}

async function countActiveStations(models: AppModels): Promise<number> {
  // T-055: una estación desactivada queda como histórico y no cuenta en el tope de la licencia.
  return models.GasStation.count({ where: { active: true } });
}

// IDs autorizados por la clave "stations" de la licencia vigente (payload v2 ya verificado), o
// null si el modo es LEGACY, no hay licencia usable, o la clave "stations" nunca se informó
// (contrato v2: no se bloquea por autorización en ese caso).
export async function getAuthorizedStationIds(models: AppModels): Promise<Set<string> | null> {
  if (!isCciMode()) return null;
  const row = await models.LicenseState.findByPk(SINGLETON_ID);
  const payload = await verifiedPayload(row?.licenseToken ?? null);
  if (!payload?.authorized?.stations) return null;
  return new Set(payload.authorized.stations);
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
  const version = process.env.npm_package_version ?? "1.0.0";

  // T-058: el informe de uso v2 exige la lista COMPLETA de estaciones activas (nunca parcial —
  // "un informe parcial nunca libera recursos" del contrato). Si listarlas falla, no se valida
  // nada: se deja que la excepción se propague al catch de abajo como error transitorio (se
  // conserva lo guardado), en vez de mandar un `usage` incompleto o inventado.
  const stations = await listActiveStations(models);
  const stationIds = stations.map((s) => s.id);
  const activeStations = stationIds.length;

  // Mismo registro que usa el rechazo explícito del servidor (HARD_REJECTIONS): no es un
  // problema de red, así que fuerza solo lectura ya, sin esperar a que venza la fecha local.
  // `unauthorizedStations` se conserva tal cual estaba: un rechazo no trae una respuesta nueva.
  const forceReadOnly = (lastError: string) =>
    models.LicenseState.upsert({
      id: SINGLETON_ID,
      licenseToken: row?.licenseToken ?? null,
      payload: row?.payload ?? null,
      serverStatus: "READ_ONLY",
      graceEndsAt: row?.graceEndsAt ?? null,
      activeStations,
      unauthorizedStations: row?.unauthorizedStations ?? null,
      lastValidatedAt: new Date(),
      lastError,
    });

  // T-062 (nombres opcionales, ADR-021): aditivo y nunca obligatorio — si no hay nombre
  // aprovechable, simplemente no se manda esa clave. `labels` solo lleva los ids que también
  // están en `ids` (los mismos `stationIds`), nunca más entradas que ids.
  const labels = Object.fromEntries(
    stations
      .map((s) => [s.id, clampLabel(s.name)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null)
  );
  const instanceLabel = clampLabel(await defaultInstanceLabel(models));

  const credential: Record<string, unknown> = {};
  if (row?.licenseToken) credential.license = row.licenseToken;
  else if (licenseKey) credential.licenseKey = licenseKey;
  else throw new Error("Falta LICENSE_KEY y no hay ninguna licencia guardada todavía.");

  // Corte limpio v1 -> v2: `activeStations` ya no existe en la petición, reemplazado por `usage`
  // con la clave "stations" de FuelTrack (ADR-009 de cci-licensing).
  const bodyWithNames: Record<string, unknown> = {
    ...credential,
    fingerprint,
    version,
    usage: { stations: { active: activeStations, ids: stationIds, ...(Object.keys(labels).length ? { labels } : {}) } },
    ...(instanceLabel ? { instanceLabel } : {}),
  };
  // Mismo cuerpo, sin nombres: reintento ante INVALID_LABEL. "Un nombre nunca puede dejar sin
  // validar" — la validación siempre sigue adelante, con o sin nombres.
  const bodyWithoutNames: Record<string, unknown> = {
    ...credential,
    fingerprint,
    version,
    usage: { stations: { active: activeStations, ids: stationIds } },
  };

  const postValidate = (body: Record<string, unknown>) =>
    axios.post(`${licenseServerUrl}/v1/licenses/validate`, body, { timeout: 8000 });

  try {
    let data: any;
    try {
      ({ data } = await postValidate(bodyWithNames));
    } catch (nameError: any) {
      if (nameError.response?.data?.code !== "INVALID_LABEL") throw nameError;
      console.warn(
        "[licencia] el nombre de la instancia fue rechazado (INVALID_LABEL); reintentando sin nombres:",
        nameError.response?.data?.message ?? nameError.message
      );
      ({ data } = await postValidate(bodyWithoutNames));
    }
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
    // T-053: una validación exitosa es la fuente más confiable de "qué hora es": sube el punto
    // más alto visto con el reloj del servidor y con la fecha de emisión de la licencia.
    const serverTime = typeof data.serverTime === "string" ? new Date(data.serverTime) : undefined;
    const newMaxSeenAt = maxDate(row?.maxSeenAt, serverTime, new Date(rawPayload.issuedAt));
    const unauthorizedStations: string[] = Array.isArray(data.unauthorized?.stations)
      ? data.unauthorized.stations
      : [];
    await models.LicenseState.upsert({
      id: SINGLETON_ID,
      licenseToken: token,
      payload: rawPayload as unknown as Record<string, unknown>,
      serverStatus: typeof data.status === "string" ? data.status : null,
      graceEndsAt: data.graceEndsAt ? new Date(data.graceEndsAt) : graceEndsAt(new Date(rawPayload.expiresAt), rawPayload.graceDays),
      activeStations,
      unauthorizedStations,
      maxSeenAt: newMaxSeenAt,
      lastValidatedAt: new Date(),
      lastError: null,
    });
  } catch (error: any) {
    const code = error.response?.data?.code;
    if (isHardRejection(code)) {
      // El servidor rechaza la licencia activamente (no es un problema de red).
      await forceReadOnly(`${code}: ${error.response?.data?.message ?? error.message}`);
      return;
    }
    if (code === "INVALID_USAGE") {
      // T-058: es un error de FuelTrack (informe de uso mal formado), no un rechazo de la
      // licencia — nunca fuerza solo lectura. El servidor garantiza no tocar nada en este caso.
      const detail = error.response?.data?.message ?? error.message;
      console.error("[licencia] el informe de uso fue rechazado (INVALID_USAGE, no se tocó nada):", detail);
      if (row) await row.update({ lastError: `INVALID_USAGE: ${detail}` });
      return;
    }
    if (error.response?.status === 429 || code === "RATE_LIMITED") {
      // T-062: igual que un error de red — no fuerza solo lectura y se conserva lo guardado. El
      // próximo intento se programa después de Retry-After, sin pasar por el antirrebote de
      // T-055 (que solo junta ráfagas de mutations; aquí el servidor ya dijo cuánto esperar).
      const retryAfterSeconds = Number(
        error.response?.data?.retryAfterSeconds ?? error.response?.headers?.["retry-after"] ?? 60
      );
      console.warn(`[licencia] límite de tasa (429): se reintenta en ${retryAfterSeconds}s, se sigue con lo guardado`);
      if (row) await row.update({ lastError: `RATE_LIMITED: reintento en ${retryAfterSeconds}s` });
      scheduleRateLimitRetry(models, retryAfterSeconds);
      return;
    }
    // Sin red u otro error transitorio: se conserva la última licencia guardada y se sigue
    // operando con la fecha local (criterio "arranque sin red con la licencia guardada").
    console.warn("[licencia] no se pudo validar contra CCI Licencias, se sigue con lo guardado:", error.message);
    if (row) await row.update({ lastError: error.message });
  }
}

// T-062: temporizador único (no debounced) para el reintento tras un 429 — a diferencia del
// antirrebote de T-055 (que junta ráfagas de llamadas en una ventana fija de 30s), este espera
// exactamente lo que pidió el servidor y no se reinicia si ya hay uno programado.
let rateLimitRetryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRateLimitRetry(models: AppModels, retryAfterSeconds: number): void {
  if (rateLimitRetryTimer) return;
  rateLimitRetryTimer = setTimeout(() => {
    rateLimitRetryTimer = null;
    fetchAndStore(models).catch((e) => console.warn("[licencia] reintento tras 429 falló:", e.message));
  }, Math.max(1, retryAfterSeconds) * 1000);
}

// Throttle del log (en memoria, no en BD): basta con avisar una vez por hora aunque el estado se
// consulte en cada mutation.
let lastSkewWarningAt = 0;
function warnClockSkew(maxSeenAt: Date, localNow: Date): void {
  if (Date.now() - lastSkewWarningAt < HOUR_MS) return;
  lastSkewWarningAt = Date.now();
  const daysBehind = Math.floor((maxSeenAt.getTime() - localNow.getTime()) / DAY_MS);
  console.warn(
    `[licencia] reloj local desfasado ${daysBehind} día(s) detrás de la última hora confiable vista (maxSeenAt=${maxSeenAt.toISOString()}, reloj local=${localNow.toISOString()})`
  );
}

// `localNow` es un parámetro (no siempre `new Date()`) para poder probar un reloj atrasado sin
// tocar el reloj real del proceso.
export async function getSnapshot(models: AppModels, localNow: Date = new Date()): Promise<LicenseSnapshot> {
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
    clockSkewDetected: false,
    trial: false,
    authorizedStationIds: [] as string[],
    unauthorizedStationIds: [] as string[],
  };

  if (!isCciMode()) {
    return { mode: "LEGACY", status: null, readOnly: false, ...base };
  }

  const row = await models.LicenseState.findByPk(SINGLETON_ID);
  const storedMaxSeenAt = row?.maxSeenAt ?? null;
  const skewed = isClockSkewed(localNow, storedMaxSeenAt);
  if (skewed) warnClockSkew(storedMaxSeenAt ?? new Date(0), localNow);

  // T-053: nunca calcular con una hora anterior a la más alta ya vista (el reloj local atrasado
  // después de un avance ya visto no tiene efecto). Se persiste como mucho una vez por hora —no
  // en cada mutation— y nunca retrocede.
  const now = effectiveNow(localNow, storedMaxSeenAt);
  if (row && localNow.getTime() - (storedMaxSeenAt?.getTime() ?? 0) >= HOUR_MS) {
    await row.update({ maxSeenAt: localNow });
  }

  const payload = await verifiedPayload(row?.licenseToken ?? null);
  if (!payload) {
    return {
      mode: "CCI1",
      status: "READ_ONLY",
      readOnly: true,
      ...base,
      clockSkewDetected: skewed,
      lastValidatedAt: row?.lastValidatedAt ?? null,
    };
  }

  const expiresAt = new Date(payload.expiresAt);
  let status = computeStatus(expiresAt, payload.graceDays, now);
  if (row!.serverStatus === "READ_ONLY") status = "READ_ONLY"; // rechazo explícito del servidor prevalece

  // T-058: `authorized.stations` ausente = nunca se informó -> no se calculan no autorizadas por
  // esta vía (solo quedan las que ya venían en `unauthorizedStations` de una respuesta anterior).
  // Presente (aunque sea []) = cualquier activa que no figure ahí también es no autorizada, no
  // solo las que el último `unauthorized` de la respuesta haya marcado (una estación pudo
  // activarse o desactivarse después de esa validación).
  const authorizedStationIds = payload.authorized?.stations ?? [];
  let unauthorizedStationIds = row!.unauthorizedStations ?? [];
  if (payload.authorized?.stations !== undefined) {
    const authorizedSet = new Set(authorizedStationIds);
    const activeIds = await listActiveStationIds(models);
    const computed = activeIds.filter((id) => !authorizedSet.has(id));
    unauthorizedStationIds = [...new Set([...unauthorizedStationIds, ...computed])];
  }

  return {
    mode: "CCI1",
    status,
    readOnly: status === "READ_ONLY",
    activeStations,
    plan: payload.plan,
    maxStations: payload.limits?.stations ?? null,
    expiresAt,
    graceEndsAt: graceEndsAt(expiresAt, payload.graceDays),
    daysRemaining: daysUntil(expiresAt, now),
    customerName: payload.customerName,
    lastValidatedAt: row!.lastValidatedAt,
    clockSkewDetected: skewed,
    trial: payload.trial === true,
    authorizedStationIds,
    unauthorizedStationIds,
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

// T-055, criterio 4: tras desactivar/reactivar una estación (o crear una), activeStations cambió
// y no tiene sentido esperar 24h para que CCI Licencias se entere. Antirrebote de 30s (ajustable
// para pruebas): varias llamadas seguidas (p. ej. desactivar 3 estaciones una tras otra) disparan
// una sola validación.
const revalidationDebouncer = createDebouncer<AppModels>((models) => {
  fetchAndStore(models).catch((e) => console.warn("[licencia] validación inmediata falló:", e.message));
}, Number(process.env.LICENSE_REVALIDATION_DEBOUNCE_MS ?? 30_000));

export function scheduleImmediateRevalidation(models: AppModels): void {
  if (!isCciMode()) return;
  revalidationDebouncer.trigger(models);
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
