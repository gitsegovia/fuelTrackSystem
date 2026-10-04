'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sale_type_configs', 'percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
    });
  },

  // No vuelve a DECIMAL(3,2): ese tipo era un bug (máx. 9.99 para un porcentaje) y con datos
  // reales (70, 100) el ALTER falla o trunca. Dejar (5,2) es inocuo y el up es idempotente.
  async down() {},
};
