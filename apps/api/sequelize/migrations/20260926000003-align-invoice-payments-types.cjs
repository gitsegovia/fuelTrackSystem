'use strict';

// Alinea invoice_payments con el modelo: amount DECIMAL(18,2), paymentDate DATE (timestamptz).
// Idempotente: si sync({alter:true}) ya aplicó estos tipos, el ALTER no cambia nada.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn('invoice_payments', 'amount', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      }, { transaction });
      await queryInterface.changeColumn('invoice_payments', 'paymentDate', {
        type: Sequelize.DATE,
        allowNull: false,
      }, { transaction });
    });
  },

  // Falla si hay montos que no caben en DECIMAL(12,2); la hora de paymentDate se pierde.
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn('invoice_payments', 'amount', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      }, { transaction });
      await queryInterface.changeColumn('invoice_payments', 'paymentDate', {
        type: Sequelize.DATEONLY,
        allowNull: false,
      }, { transaction });
    });
  },
};
