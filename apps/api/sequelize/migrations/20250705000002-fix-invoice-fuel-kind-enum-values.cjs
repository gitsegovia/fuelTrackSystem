'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Cambiar la columna a TEXT para poder drop+recrear el enum
    await queryInterface.sequelize.query(`ALTER TABLE invoices ALTER COLUMN "fuelType" TYPE TEXT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_invoices_fuelType"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_invoices_fuelType" AS ENUM ('GASOLINE_91', 'GASOLINE_95', 'DIESEL', 'KEROSENE')`);
    await queryInterface.sequelize.query(`ALTER TABLE invoices ALTER COLUMN "fuelType" TYPE "enum_invoices_fuelType" USING "fuelType"::"enum_invoices_fuelType"`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE invoices ALTER COLUMN "fuelType" TYPE TEXT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_invoices_fuelType"`);
    await queryInterface.sequelize.query(`CREATE TYPE "enum_invoices_fuelType" AS ENUM ('Gasoline91', 'Gasoline95', 'Diesel', 'Kerosene')`);
    await queryInterface.sequelize.query(`ALTER TABLE invoices ALTER COLUMN "fuelType" TYPE "enum_invoices_fuelType" USING "fuelType"::"enum_invoices_fuelType"`);
  },
};
