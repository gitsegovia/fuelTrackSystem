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
    // Devolver los datos a los valores viejos antes de castear al enum viejo.
    await queryInterface.sequelize.query(`
      UPDATE employee_shifts SET "employeeRole" = CASE "employeeRole"
        WHEN 'CASHIER' THEN 'Cashier'
        WHEN 'DISPATCHER' THEN 'Dispatcher'
        WHEN 'ADMIN' THEN 'Administrator'
        WHEN 'MANAGER' THEN 'Manager'
        WHEN 'SUPERVISOR' THEN 'Supervisor'
        WHEN 'ACCOUNTANT' THEN 'Accountant'
        ELSE "employeeRole" END
    `);
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
