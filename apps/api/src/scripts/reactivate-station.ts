/**
 * reactivate-station.ts
 *
 * Reactiva una estación que el cliente desactivó (T-055, decisión de José 2026-10-08: "No puede
 * reactivar ni su ADMIN, solo Core Code Innovation"). No hay mutation GraphQL para esto a
 * propósito: así ningún usuario del cliente puede rotar estaciones activas para operarlas todas
 * con una licencia menor. Lo corre José (o alguien de CCI) con acceso al servidor.
 *
 * En modo CCI1 respeta el tope de la licencia: si ya se llegó a `maxStations`, aborta sin tocar
 * nada. Valida con CCI Licencias enseguida después de reactivar (sin el antirrebote de 30s de las
 * mutations: esta es una sola corrida de un script, no una ráfaga de llamadas que haya que juntar).
 *
 * Uso en contenedor de desarrollo:
 *   docker compose exec api node --loader ts-node/esm \
 *     --experimental-specifier-resolution=node \
 *     src/scripts/reactivate-station.ts \
 *     -- --id <uuid> [--operator "José Segovia"]
 *   # o, si no se tiene el id a mano:
 *     -- --name "Estación Sur" [--operator "José Segovia"]
 *
 * Uso en contenedor de producción (requiere imagen compilada):
 *   docker compose exec api node dist/scripts/reactivate-station.js --id <uuid>
 */

import "../config/index.js";
import { models, sequelize } from "../models/index.js";
import { fetchAndStore, getSnapshot, initLicenseKey, isCciMode } from "../license/service.js";

function parseArgs(): { id?: string; name?: string; operator: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const id = get("--id");
  const name = get("--name");
  const operator = get("--operator") ?? process.env.USER ?? process.env.USERNAME ?? "desconocido";

  if (!id && !name) {
    console.error('Uso: reactivate-station --id <uuid> | --name "<nombre exacto>" [--operator "<nombre>"]');
    process.exit(1);
  }

  return { id, name, operator };
}

async function main() {
  const { id, name, operator } = parseArgs();

  await sequelize.authenticate();
  await initLicenseKey();

  const station = id
    ? await models.GasStation.findByPk(id)
    : await models.GasStation.findOne({ where: { name } });

  if (!station) {
    console.error(`No se encontró la estación (${id ? `id: ${id}` : `nombre: "${name}"`}).`);
    await sequelize.close();
    process.exit(1);
  }

  if (station.active) {
    console.log(`La estación "${station.name}" (id: ${station.id}) ya está activa. No se hizo nada.`);
    await sequelize.close();
    process.exit(0);
  }

  if (isCciMode()) {
    const snapshot = await getSnapshot(models);
    if (snapshot.maxStations != null && snapshot.activeStations >= snapshot.maxStations) {
      console.error(
        `No se puede reactivar "${station.name}": la licencia permite hasta ${snapshot.maxStations} ` +
          `estación(es) y ya hay ${snapshot.activeStations} activa(s). Abortado sin cambiar nada.`
      );
      await sequelize.close();
      process.exit(1);
    }
  }

  await station.update({ active: true });

  // Constancia de quién, cuándo y qué estación (no existe hoy una tabla de auditoría de acciones
  // administrativas genérica; esta línea de log es la constancia, como pide la tarea "si existe").
  console.log(
    `✓ Estación reactivada: "${station.name}" (id: ${station.id}) — por: ${operator} — cuándo: ${new Date().toISOString()}`
  );

  if (isCciMode()) {
    await fetchAndStore(models).catch((e) =>
      console.warn("No se pudo validar con CCI Licencias ahora; se reintentará en el próximo ciclo:", e.message)
    );
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Error al reactivar la estación:", err.message ?? err);
  process.exit(1);
});
