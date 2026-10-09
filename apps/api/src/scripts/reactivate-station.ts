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
 * T-058 (contrato v2): reactivar en FuelTrack no autoriza la estación en CCI Licencias — un id
 * liberado no vuelve a entrar solo, aunque haya cupo (ADR-012 de cci-licensing). El orden completo
 * es: (a) este script reactiva y valida, la estación queda activa pero "no autorizada"; (b) José
 * la reautoriza en el panel de CCI Licencias; (c) se corre `validate-license` para que FuelTrack
 * reciba la licencia con la estación ya autorizada. El script explica esto al terminar.
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
    const validated = await fetchAndStore(models)
      .then(() => true)
      .catch((e) => {
        console.warn("No se pudo validar con CCI Licencias ahora; se reintentará en el próximo ciclo:", e.message);
        return false;
      });

    if (validated) {
      const snapshot = await getSnapshot(models);
      const stillUnauthorized = snapshot.unauthorizedStationIds.includes(station.id);
      console.log(
        `\n${stillUnauthorized ? "Importante" : "Listo"}: la estación quedó activa en FuelTrack, pero ` +
          `CCI Licencias ${stillUnauthorized ? "todavía no la autoriza" : "ya la tiene autorizada"}. ` +
          `Un id liberado no vuelve a entrar solo, aunque haya cupo. Pasos:\n` +
          `  1) listo — ya corriste este script, que reactivó y validó.\n` +
          `  2) ${stillUnauthorized ? "Falta: " : "(no hace falta) "}reautorizá "${station.name}" en el panel de CCI Licencias (con cupo disponible).\n` +
          `  3) ${stillUnauthorized ? "Falta: " : "(no hace falta) "}corré "npm run validate-license" para que FuelTrack reciba la licencia con la estación autorizada.`
      );
    }
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Error al reactivar la estación:", err.message ?? err);
  process.exit(1);
});
