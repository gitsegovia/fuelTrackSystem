#!/bin/sh

# Abort on any error
set -e

echo "Generating machine fingerprint..."
# Define la ruta de destino para el fingerprint final. Usa el valor por defecto si la variable no está seteada.
FINGERPRINT_DESTINATION=${FINGERPRINT_PATH:-/etc/fueltrack/fingerprint}

# Crea el directorio de destino si no existe.
# El comando 'dirname' obtiene el directorio padre del archivo.
mkdir -p "$(dirname "$FINGERPRINT_DESTINATION")"

# Concatena los identificadores y calcula su hash SHA-256, guardando solo el hash.
# El comando 'sha256sum' es estándar en imágenes Alpine/Debian.
# El 'cut' es para quedarnos solo con el hash y no con el nombre del archivo.
(tr -d '\n' < /run/secrets/machine-id && tr -d '\n' < /run/secrets/mac-address) | sha256sum | cut -d' ' -f1 > "$FINGERPRINT_DESTINATION"

echo "Fingerprint generated at ${FINGERPRINT_DESTINATION}"

echo "Waiting for database to be ready..."

# Espera a que la base de datos esté lista. Usa las mismas variables de entorno que docker-compose.
# El bucle 'until' intentará conectarse hasta que tenga éxito.
echo "-h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER}"

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 1
done

echo "Database is ready. Running migrations..."
npx sequelize-cli db:migrate

echo "Migrations finished."

# Carga seeds solo si SEED_DB=true Y la tabla companies está vacía (evita duplicados en reinicios).
if [ "$SEED_DB" = "true" ]; then
  COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$COUNT" = "0" ]; then
    echo "Running seeds..."
    npx sequelize-cli db:seed:all
    echo "Seeds loaded."
  else
    echo "Database already seeded (companies: $COUNT), skipping."
  fi
fi

echo "Starting the application..."
# 'exec "$@"' ejecuta el comando que se pasó al entrypoint (el CMD del Dockerfile).
exec "$@"