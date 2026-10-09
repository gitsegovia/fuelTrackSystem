/**
 * validate-license.ts
 *
 * Fuerza una validación contra CCI Licencias y muestra el estado resultante (autorizadas, no
 * autorizadas, tope, vencimiento). T-058: es el paso (c) del flujo de reactivación de una
 * estación — después de que José la reautoriza en el panel de CCI Licencias (paso b), esta
 * corrida es lo que hace que FuelTrack reciba la licencia con esa estación ya autorizada, en vez
 * de esperar a la revalidación diaria. También sirve para forzar una validación por cualquier
 * otro motivo (cambio de plan, renovación de pago, etc.) sin esperar.
 *
 * En modo LEGACY no hay nada que validar: el script lo informa y termina sin hacer nada.
 *
 * Uso en contenedor de desarrollo:
 *   docker compose exec api node --loader ts-node/esm \
 *     --experimental-specifier-resolution=node \
 *     src/scripts/validate-license.ts
 *
 * Uso en contenedor de producción (requiere imagen compilada):
 *   docker compose exec api node dist/scripts/validate-license.js
 */

import "../config/index.js";
import { models, sequelize } from "../models/index.js";
import { fetchAndStore, getSnapshot, initLicenseKey, isCciMode } from "../license/service.js";

async function main() {
  await sequelize.authenticate();
  await initLicenseKey();

  if (!isCciMode()) {
    console.log("Modo LEGACY (sin clave pública configurada): no hay nada que validar contra CCI Licencias.");
    await sequelize.close();
    return;
  }

  await fetchAndStore(models);
  const snapshot = await getSnapshot(models);

  console.log(`Estado: ${snapshot.status}  (${snapshot.readOnly ? "SOLO LECTURA" : "operando"})`);
  console.log(`Plan: ${snapshot.plan ?? "—"}  Prueba gratis: ${snapshot.trial ? "sí" : "no"}`);
  console.log(`Estaciones: ${snapshot.activeStations} activa(s) / tope ${snapshot.maxStations ?? "sin tope"}`);
  console.log(
    `Autorizadas (${snapshot.authorizedStationIds.length}): ${snapshot.authorizedStationIds.join(", ") || "—"}`
  );
  console.log(
    `No autorizadas (${snapshot.unauthorizedStationIds.length}): ${snapshot.unauthorizedStationIds.join(", ") || "—"}`
  );
  console.log(
    `Vence: ${snapshot.expiresAt?.toISOString() ?? "—"}  Gracia hasta: ${snapshot.graceEndsAt?.toISOString() ?? "—"}`
  );

  await sequelize.close();
}

main().catch((err) => {
  console.error("Error al validar la licencia:", err.message ?? err);
  process.exit(1);
});
