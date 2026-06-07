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
}

interface Config {
  port: number;
  databaseUrl: ConfigDb;
  jwtSecret: string;
}

const config_db: ConfigDb = {
  database: process.env.DB_DATABASE || "s",
  username: process.env.DB_USER || "s",
  password: process.env.DB_PASS || "s",
  host: process.env.DB_HOST || "s",
  port: parseInt(process.env.DB_PORT || "s"),
  dialect: process.env.DB_CONNECTOR || "s",
};

const config: Config = {
  port: parseInt(process.env.PORT || "s", 10),
  databaseUrl: config_db,
  jwtSecret: process.env.JWT_SECRET || "s",
};

export default config;
