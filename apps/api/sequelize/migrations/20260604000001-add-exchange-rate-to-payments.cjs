'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'exchangeRateAtPayment', {
      type: Sequelize.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 1,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'exchangeRateAtPayment');
  },
};
