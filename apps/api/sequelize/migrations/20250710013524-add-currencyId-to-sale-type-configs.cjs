// sequelize/migrations/YYYYMMDDHHmmss-add-currencyId-to-sale-type-configs.cjs

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Añadir la columna currencyId a la tabla sale_type_configs
    await queryInterface.addColumn('sale_type_configs', 'currencyId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'currencies', // nombre de la tabla referenciada
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // En caso de revertir la migración, elimina la columna
    await queryInterface.removeColumn('sale_type_configs', 'currencyId');
  }
};