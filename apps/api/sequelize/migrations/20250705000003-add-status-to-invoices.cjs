'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('invoices', 'status', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'PENDING',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'status');
  },
};
