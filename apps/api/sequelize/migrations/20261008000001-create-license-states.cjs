'use strict';

/** @type {import('sequelize-cli').Migration} */
// Una sola fila (id fijo) con la última licencia CCI1 verificada y guardada, para poder
// arrancar sin red (T-050). Si no se usa el modo CCI1 (sin LICENSE_PUBLIC_KEY), la tabla
// queda vacía y no afecta nada.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (names.includes('license_states')) return;

    await queryInterface.createTable('license_states', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      licenseToken: {
        type: Sequelize.TEXT, // "CCI1.<payload>.<firma>" tal como lo verificamos la última vez
        allowNull: true,
      },
      payload: {
        type: Sequelize.JSONB, // payload ya verificado (nunca se confía en el payload que manda el server sin reverificar)
        allowNull: true,
      },
      serverStatus: {
        type: Sequelize.STRING, // último estado informado por /v1/licenses/validate, o 'READ_ONLY' si el server rechazó la licencia
        allowNull: true,
      },
      graceEndsAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      activeStations: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      lastValidatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastError: {
        type: Sequelize.TEXT,
        allowNull: true,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('license_states');
  },
};
