'use strict';

// Tablas nuevas de este cambio (ADR-014). Si ya existen es porque sync({alter:true}) corrió con
// estos mismos modelos, así que el down las elimina igual (le pertenecen a esta migración).

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tables = await queryInterface.showAllTables({ transaction });

      if (!tables.includes('auth_sessions')) {
        await queryInterface.createTable('auth_sessions', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          expiresAt: { type: Sequelize.DATE, allowNull: false },
          revokedAt: { type: Sequelize.DATE, allowNull: true },
          revokedReason: { type: Sequelize.STRING(20), allowNull: true },
          createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('auth_sessions', ['userId'], { name: 'auth_sessions_user_id', transaction });
      }

      if (!tables.includes('refresh_tokens')) {
        await queryInterface.createTable('refresh_tokens', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
            allowNull: false,
          },
          sessionId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'auth_sessions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          tokenHash: { type: Sequelize.STRING(64), allowNull: false },
          replacedById: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'refresh_tokens', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          rotatedAt: { type: Sequelize.DATE, allowNull: true },
          createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('refresh_tokens', ['tokenHash'], {
          name: 'refresh_tokens_token_hash_uq',
          unique: true,
          transaction,
        });
        await queryInterface.addIndex('refresh_tokens', ['sessionId'], { name: 'refresh_tokens_session_id', transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('refresh_tokens', { transaction });
      await queryInterface.dropTable('auth_sessions', { transaction });
    });
  },
};
