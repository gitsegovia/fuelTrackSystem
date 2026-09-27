'use strict';

const INDEX = 'offline_mutation_logs_client_mutation_id_uq';

// Columnas nuevas de este cambio: si ya existen es porque sync({alter:true}) corrió con este mismo
// modelo, así que el down las quita igual (le pertenecen a esta migración).

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable('offline_mutation_logs');
      if (!columns.clientMutationId) {
        await queryInterface.addColumn('offline_mutation_logs', 'clientMutationId', {
          type: Sequelize.UUID,
          allowNull: true,
        }, { transaction });
      }
      if (!columns.status) {
        await queryInterface.addColumn('offline_mutation_logs', 'status', {
          type: Sequelize.STRING(10),
          allowNull: true,
        }, { transaction });
      }
      if (!columns.responseData) {
        await queryInterface.addColumn('offline_mutation_logs', 'responseData', {
          type: Sequelize.JSONB,
          allowNull: true,
        }, { transaction });
      }
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON offline_mutation_logs ("clientMutationId")`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`, { transaction });
      await queryInterface.removeColumn('offline_mutation_logs', 'responseData', { transaction });
      await queryInterface.removeColumn('offline_mutation_logs', 'status', { transaction });
      await queryInterface.removeColumn('offline_mutation_logs', 'clientMutationId', { transaction });
    });
  },
};
