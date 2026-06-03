// sequelize/migrations/YYYYMMDDHHmmss-add-gasStationId-to-employees.cjs

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Añadir la columna gasStationId a la tabla employees
    await queryInterface.addColumn('employees', 'gasStationId', {
      type: Sequelize.UUID,
      allowNull: false, // O true, dependiendo de si debe ser obligatorio desde el principio
      references: {
        model: 'gas_stations', // nombre de la tabla referenciada
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT', // No eliminar la estación si tiene empleados asociados
    });

    // Opcional: Si la columna es NOT NULL y ya existen empleados, necesitarás
    // actualizar los registros existentes con un valor antes de hacerla NOT NULL.
    // Por ejemplo, asignarle una gasStationId por defecto o nulo temporalmente.
    // Si no tienes datos aún, allowNull: false está bien desde el inicio.

    // Puedes añadir un índice si quieres (opcional, pero mejora rendimiento)
    // await queryInterface.addIndex('employees', ['gasStationId'], {
    //   name: 'employees_gasStationId_idx',
    // });
  },

  down: async (queryInterface, Sequelize) => {
    // En caso de revertir la migración, elimina la columna
    await queryInterface.removeColumn('employees', 'gasStationId');
  }
};