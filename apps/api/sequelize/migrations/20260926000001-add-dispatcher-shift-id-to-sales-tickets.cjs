'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // BD creadas por sync({alter:true}) ya tienen la columna.
    const columns = await queryInterface.describeTable('sales_tickets');
    if (columns.dispatcherShiftId) return;

    await queryInterface.addColumn('sales_tickets', 'dispatcherShiftId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'employee_shifts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sales_tickets', 'dispatcherShiftId');
  },
};
