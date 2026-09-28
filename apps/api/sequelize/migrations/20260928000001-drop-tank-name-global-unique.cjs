'use strict';

// H-015: Tank.name tenía un unique global (impedía "T1" en dos estaciones distintas) además del
// índice compuesto (gasStationId, name), que es el que debe seguir. El nombre del constraint
// depende de quién lo creó (migración inicial o sync({alter:true})), así que se busca en el
// catálogo en vez de asumirlo, y solo se toca si es de una sola columna ("name").

async function findSingleColumnUnique(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT c.conname FROM pg_constraint c
     WHERE c.conrelid = 'tanks'::regclass
       AND c.contype = 'u'
       AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid = 'tanks'::regclass AND attname = 'name')]::smallint[]`,
    { transaction }
  );
  return rows[0]?.conname ?? null;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const name = await findSingleColumnUnique(queryInterface, transaction);
      if (name) {
        await queryInterface.sequelize.query(`ALTER TABLE tanks DROP CONSTRAINT "${name}"`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const name = await findSingleColumnUnique(queryInterface, transaction);
      if (!name) {
        await queryInterface.addConstraint('tanks', {
          fields: ['name'],
          type: 'unique',
          name: 'tanks_name_key',
          transaction,
        });
      }
    });
  },
};
