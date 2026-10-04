'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'Regular' TO 'REGULAR'`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'Premium' TO 'PREMIUM'`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'Subsidized' TO 'SUBSIDIZED'`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'REGULAR' TO 'Regular'`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'PREMIUM' TO 'Premium'`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_sale_type_configs_saleTypeName" RENAME VALUE 'SUBSIDIZED' TO 'Subsidized'`);
  },
};
