import { Sequelize } from "sequelize";
import config from "./index";

const sequelize = new Sequelize({
  database: config.databaseUrl.database,
  host: config.databaseUrl.host,
  username: config.databaseUrl.username,
  password: config.databaseUrl.password,
  port: config.databaseUrl.port,
  dialect: "postgres",
  // H-026: SSL solo si DB_SSL=true (config/index.ts). Sin eso, igual que siempre: sin SSL.
  dialectOptions: config.databaseUrl.ssl
    ? { ssl: { require: true, rejectUnauthorized: config.databaseUrl.sslRejectUnauthorized } }
    : {},
  logging: false,
});

export default sequelize;
