'use strict';

/** @type {import('sequelize-cli').Migration} */
// T-055 (ADR-004 de CCI Licencias): para bajar de plan, el cliente desactiva en FuelTrack las
// estaciones que sobran en vez de borrarlas. Las existentes quedan activas (no cambia nada hoy).
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('gas_stations');
    if (columns.active) return;

    await queryInterface.addColumn('gas_stations', 'active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('gas_stations', 'active');
  },
};
