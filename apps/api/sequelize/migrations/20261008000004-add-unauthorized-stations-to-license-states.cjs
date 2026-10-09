'use strict';

/** @type {import('sequelize-cli').Migration} */
// T-058 (contrato v2 de CCI Licencias): ids de "stations" que la última validación marcó fuera de
// `authorized` (metadata de la respuesta, no del payload firmado).
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('license_states');
    if (columns.unauthorizedStations) return;

    await queryInterface.addColumn('license_states', 'unauthorizedStations', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    // Simétrico con el up: si el up hizo skip (columna ya creada por sync), el down no la borra.
    const columns = await queryInterface.describeTable('license_states');
    if (!columns.unauthorizedStations) return;

    await queryInterface.removeColumn('license_states', 'unauthorizedStations');
  },
};
