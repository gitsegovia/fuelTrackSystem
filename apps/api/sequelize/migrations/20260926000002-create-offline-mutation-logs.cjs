'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // BD creadas por sync({alter:true}) ya tienen la tabla.
    const tables = await queryInterface.showAllTables();
    if (tables.includes('offline_mutation_logs')) return;

    await queryInterface.createTable('offline_mutation_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      operationName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      deviceFingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      queuedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      variables: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('offline_mutation_logs');
  },
};
