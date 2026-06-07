import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

// Solo cargar .env.local en dev local — si DB_HOST ya viene del entorno (Docker), no pisar.
const localEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.local')
if (existsSync(localEnv) && !process.env.DOCKER_ENV) {
  dotenv.config({ path: localEnv, override: true })
}

export default {
  // Configuración para el entorno de desarrollo
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432, // Puerto por defecto para PostgreSQL
    dialect: 'postgres', 
    logging: console.log,
  },

  // Configuración para el entorno de prueba (si lo tienes)
  test: {
    username: process.env.DB_TEST_USER,
    password: process.env.DB_TEST_PASSWORD,
    database: process.env.DB_TEST_DATABASE,
    host: process.env.DB_TEST_HOST,
    port: process.env.DB_TEST_PORT || 5432,
    dialect: 'postgres',
  },

  // Configuración para el entorno de producción
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ||  5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true, // Requerir SSL
        rejectUnauthorized: false, // ¡Cuidado! Deshabilita la validación del certificado SSL.
                                  // Solo úsalo si tu proveedor de base de datos no tiene un certificado validado
                                  // o si no quieres configurar uno. Para producción, busca una validación más estricta.
      },
    },
    // Si usas un URL de conexión completo (como en Heroku, Railway, etc.)
    // use_env_variable: 'DATABASE_URL', // El nombre de tu variable de entorno
  },
};