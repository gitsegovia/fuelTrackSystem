'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sale_type_configs', 'percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('sale_type_configs', 'percentage', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
    });
  },
};
