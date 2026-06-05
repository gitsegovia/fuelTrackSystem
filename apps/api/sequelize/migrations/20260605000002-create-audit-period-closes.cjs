'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotente: DROP + CREATE para que sea re-ejecutable en dev
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS "audit_period_closes" CASCADE;
      DROP TYPE IF EXISTS "enum_audit_period_closes_closeType" CASCADE;
      DROP TYPE IF EXISTS "enum_audit_period_closes_status" CASCADE;
    `);

    await queryInterface.createTable('audit_period_closes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      closedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      periodStart: { type: Sequelize.DATE, allowNull: false },
      periodEnd: { type: Sequelize.DATE, allowNull: false },
      closeType: {
        type: Sequelize.ENUM('MONTHLY', 'MANUAL'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'CLOSED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      invoiceSnapshot: { type: Sequelize.JSONB, allowNull: true },
      shiftSnapshot: { type: Sequelize.JSONB, allowNull: true },
      dispatcherSnapshot: { type: Sequelize.JSONB, allowNull: true },
      tankSnapshot: { type: Sequelize.JSONB, allowNull: true },
      financialSnapshot: { type: Sequelize.JSONB, allowNull: true },
      driverSnapshot: { type: Sequelize.JSONB, allowNull: true },
      marginSnapshot: { type: Sequelize.JSONB, allowNull: true },
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

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_period_closes_station" ON "audit_period_closes" ("gasStationId");
      CREATE INDEX IF NOT EXISTS "idx_audit_period_closes_period" ON "audit_period_closes" ("periodStart", "periodEnd");
      CREATE INDEX IF NOT EXISTS "idx_audit_period_closes_status" ON "audit_period_closes" ("status");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_period_closes');
  },
};
