import { Sequelize } from "sequelize";
import config from "./index";

const sequelize = new Sequelize({
  database: config.databaseUrl.database,
  host: config.databaseUrl.host,
  username: config.databaseUrl.username,
  password: config.databaseUrl.password,
  port: config.databaseUrl.port,
  dialect: "postgres",
  logging: false,
});

export default sequelize;
