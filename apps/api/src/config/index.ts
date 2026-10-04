import dotenv from "dotenv";
import { existsSync } from "fs";

// Carga .env base, luego .env.local lo sobreescribe si existe (solo dev local).
// En Docker, DOCKER_ENV=true evita que .env.local pise las vars del contenedor.
dotenv.config();
if (existsSync(".env.local") && !process.env.DOCKER_ENV) {
  dotenv.config({ path: ".env.local", override: true });
}

interface ConfigDb {
  database: string;
  username: string;
  password: string;
  host: string;
  port: number;
  dialect: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
}

interface Config {
  port: number;
  databaseUrl: ConfigDb;
  jwtSecret: string;
  sessionMaxHours: number;
  accessTokenMinutes: number;
  refreshGraceSeconds: number;
}

// H-018: en producción, nunca arrancar con un secreto/host/puerto trivial ("s", NaN) por una
// variable faltante. En desarrollo, usar un default explícito y avisar, no fallar en silencio.
const isProduction = process.env.NODE_ENV === "production";
const missing: string[] = [];
const invalid: string[] = [];

const DEV_DEFAULTS = {
  PORT: "3000",
  DB_DATABASE: "fueltrack_dev",
  DB_USER: "postgres",
  DB_PASS: "postgres",
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_CONNECTOR: "postgres",
  JWT_SECRET: "dev-only-insecure-secret-do-not-use-in-production",
} as const;

function readRequired(name: keyof typeof DEV_DEFAULTS): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    missing.push(name);
    return "";
  }
  console.warn(`[config] ${name} no está definida; usando default de desarrollo.`);
  return DEV_DEFAULTS[name];
}

function readRequiredPort(name: "PORT" | "DB_PORT"): number {
  const raw = readRequired(name);
  if (isProduction && !raw) return 0; // ya reportado como "falta" en readRequired
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (isProduction) {
    invalid.push(`${name}="${raw}" no es un puerto válido`);
    return 0;
  }
  console.warn(`[config] ${name}="${raw}" no es un puerto válido; usando ${DEV_DEFAULTS[name]}.`);
  return parseInt(DEV_DEFAULTS[name], 10);
}

// Duración de sesión/tokens (ADR-014, T-019): siempre tienen un default razonable, así que un
// valor ausente no es un error; uno presente pero inválido sí se avisa (se ignora igual).
function positiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  console.warn(`[config] ${name}="${raw}" no es válido (> 0); usando ${fallback}.`);
  return fallback;
}

function nonNegativeNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  console.warn(`[config] ${name}="${raw}" no es válido (>= 0); usando ${fallback}.`);
  return fallback;
}

// H-026: SSL de Postgres configurable, no forzado. Sin DB_SSL, el runtime de la app se conecta
// igual que hoy (sin SSL) — compatible con el Postgres de docker-compose y con dev local.
function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true";
}

const config_db: ConfigDb = {
  database: readRequired("DB_DATABASE"),
  username: readRequired("DB_USER"),
  password: readRequired("DB_PASS"),
  host: readRequired("DB_HOST"),
  port: readRequiredPort("DB_PORT"),
  dialect: readRequired("DB_CONNECTOR"),
  // DB_SSL=true habilita SSL (por defecto apagado); DB_SSL_REJECT_UNAUTHORIZED=false permite un
  // certificado no validado (por defecto true: rechaza certificados inválidos).
  ssl: readBoolean("DB_SSL", false),
  sslRejectUnauthorized: readBoolean("DB_SSL_REJECT_UNAUTHORIZED", true),
};

const config: Config = {
  port: readRequiredPort("PORT"),
  databaseUrl: config_db,
  jwtSecret: readRequired("JWT_SECRET"),
  // ADR-014: tope absoluto de la sesión desde el login, y vida del access token.
  sessionMaxHours: positiveNumber("SESSION_MAX_HOURS", 24),
  accessTokenMinutes: positiveNumber("ACCESS_TOKEN_MINUTES", 15),
  // T-019: 0 desactiva la gracia (todo reuso revoca la sesión).
  refreshGraceSeconds: nonNegativeNumber("REFRESH_GRACE_SECONDS", 60),
};

if (isProduction && (missing.length > 0 || invalid.length > 0)) {
  const problems = [
    ...missing.map((name) => `falta ${name}`),
    ...invalid,
  ];
  console.error(
    `[config] NODE_ENV=production con configuración inválida: ${problems.join("; ")}.`
  );
  process.exit(1);
}

export default config;
