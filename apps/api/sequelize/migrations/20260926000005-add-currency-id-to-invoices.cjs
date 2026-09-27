'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // BD creadas por sync({alter:true}) ya tienen la columna.
    const columns = await queryInterface.describeTable('invoices');
    if (columns.currencyId) return;

    // NOT NULL sin default: falla a propósito si ya hay facturas; qué moneda asignarles es decisión de negocio.
    await queryInterface.addColumn('invoices', 'currencyId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'currencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'currencyId');
  },
};
