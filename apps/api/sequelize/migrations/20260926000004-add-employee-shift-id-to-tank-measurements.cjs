'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // BD creadas por sync({alter:true}) ya tienen la columna.
    const columns = await queryInterface.describeTable('tank_measurements');
    if (columns.employeeShiftId) return;

    await queryInterface.addColumn('tank_measurements', 'employeeShiftId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'employee_shifts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tank_measurements', 'employeeShiftId');
  },
};
