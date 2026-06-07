'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE employee_shifts ALTER COLUMN "employeeRole" TYPE TEXT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_employee_shifts_employeeRole"`);
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_employee_shifts_employeeRole"
      AS ENUM ('CASHIER', 'DISPATCHER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'ACCOUNTANT')
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE employee_shifts
      ALTER COLUMN "employeeRole"
      TYPE "enum_employee_shifts_employeeRole"
      USING "employeeRole"::"enum_employee_shifts_employeeRole"
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE employee_shifts ALTER COLUMN "employeeRole" TYPE TEXT`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_employee_shifts_employeeRole"`);
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_employee_shifts_employeeRole"
      AS ENUM ('Administrator','Cashier','FuelAttendant','Dispatcher','Manager','Supervisor','Accountant')
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE employee_shifts
      ALTER COLUMN "employeeRole"
      TYPE "enum_employee_shifts_employeeRole"
      USING "employeeRole"::"enum_employee_shifts_employeeRole"
    `);
  },
};
