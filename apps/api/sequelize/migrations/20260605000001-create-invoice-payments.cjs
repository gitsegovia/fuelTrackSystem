'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      invoiceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      paymentDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      bankName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      paymentMethod: {
        type: Sequelize.ENUM('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD'),
        allowNull: false,
      },
      referenceNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      recordedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('invoice_payments', ['invoiceId'], { name: 'idx_invoice_payments_invoice' });
    await queryInterface.addIndex('invoice_payments', ['recordedById'], { name: 'idx_invoice_payments_recorded_by' });
    await queryInterface.addIndex('invoice_payments', ['paymentDate'], { name: 'idx_invoice_payments_date' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoice_payments');
  },
};
