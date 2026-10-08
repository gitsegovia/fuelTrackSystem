'use strict';

/** @type {import('sequelize-cli').Migration} */
// T-053: la hora más alta vista por la instalación (serverTime, issuedAt, o el reloj local en
// cada chequeo), para que atrasar el reloj del servidor y cortar la red no rejuvenezca la
// licencia CCI1. Nula en filas existentes: se trata como "nunca se vio nada" (equivalente a la
// época unix) hasta la próxima validación o chequeo, sin romper lo que ya había.
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('license_states');
    if (columns.maxSeenAt) return;

    await queryInterface.addColumn('license_states', 'maxSeenAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('license_states', 'maxSeenAt');
  },
};
