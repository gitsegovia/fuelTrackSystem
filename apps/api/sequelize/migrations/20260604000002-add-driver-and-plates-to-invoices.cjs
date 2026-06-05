'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('invoices', 'truckIdentifier', 'truckPlate');
    await queryInterface.addColumn('invoices', 'tankPlate', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('invoices', 'driverName', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('invoices', 'driverIdNumber', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'driverIdNumber');
    await queryInterface.removeColumn('invoices', 'driverName');
    await queryInterface.removeColumn('invoices', 'tankPlate');
    await queryInterface.renameColumn('invoices', 'truckPlate', 'truckIdentifier');
  },
};
