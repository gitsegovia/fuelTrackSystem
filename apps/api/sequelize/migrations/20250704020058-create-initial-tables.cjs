'use strict';

// Valores del ENUM UserType (hardcodeados para la migración JS)
const USER_TYPE_ENUM_VALUES = [
  'Administrator',
  'Supervisor',
  'Cashier',
  'FuelAttendant',
  'Administrative'
];

// Valores del ENUM UserRole (hardcodeados para la migración JS)
const USER_ROLE_ENUM_VALUES = [
  'ADMIN',
  'MANAGER',
  'EMPLOYEE'
];

// --- ¡NUEVO ENUM para FuelType! ---
const FUEL_TYPE_ENUM_VALUES = [
  'Gasoline91',
  'Gasoline95',
  'Diesel',
  'Kerosene',
];

// --- ¡NUEVO ENUM para SaleTypeName! ---
const SALE_TYPE_NAME_ENUM_VALUES = [
  'Regular',
  'Premium',
  'Subsidized',
];

const EMPLOYEE_ROLE_ENUM_VALUES = [
  'Cashier',
  'FuelAttendant',
  'Administrative'
];

const READING_TYPE_ENUM_VALUES = ['Initial', 'Final'];

const SALES_TICKET_STATUS_ENUM_VALUES  = [
  "Pending Payment and Dispatch",
"Paid - Dispatch Pending",
"Completed",
"Canceled",
]

const PAYMENT_METHOD_ENUM_VALUES = [
  'Cash',
  'Debit Card',
  'Credit Card',
  'Mobile Payment',
  'Transfer',
];

const MEASUREMENT_REASON_ENUM_VALUES = [
  'Shift Closure',
  'Before Reception',
  'After Reception',
  'Audit',
  'Other',
];

module.exports = {
  /**
   * Método `up` para aplicar la migración (crear tablas)
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize').Sequelize} Sequelize
   */
  up: async (queryInterface, Sequelize) => {
    // 1. Crear la tabla 'companies'
    await queryInterface.createTable('companies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      logo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Crear la tabla 'gas_stations'
    await queryInterface.createTable('gas_stations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'companies', // Nombre de la tabla a la que hace referencia
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    
    // 3. Crear la tabla 'currencies'
    await queryInterface.createTable('currencies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      symbol: {
        type: Sequelize.STRING(5),
        allowNull: false,
        unique: true,
      },
      exchangeRate: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: 1.0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 4. Crear la tabla 'users'
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Constraint UNIQUE para el username
      },
      passwordHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        // Define el ENUM directamente con los valores
        type: Sequelize.ENUM(...USER_ROLE_ENUM_VALUES),
        defaultValue: 'EMPLOYEE',
        allowNull: false,
      },
      userType: {
        // Define el ENUM directamente con los valores
        type: Sequelize.ENUM(...USER_TYPE_ENUM_VALUES),
        defaultValue: 'Administrative', // Valor por defecto
        allowNull: false,
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: true, // Puede ser nulo
        references: {
          model: 'gas_stations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', // Si la estación se elimina, este campo se pone a NULL
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 5. Crear la tabla 'employees'
    await queryInterface.createTable('employees', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true, // Asegura que solo haya un perfil de empleado por usuario
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      position: {
        type: Sequelize.STRING, // Puedes usar ENUM si tienes posiciones fijas
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 6. Crear la tabla 'invoices'
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      invoiceNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      controlNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sealNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      liters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      dispatchDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      dischargeDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      truckIdentifier: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fuelType: {
        type: Sequelize.ENUM(...FUEL_TYPE_ENUM_VALUES),
        allowNull: false,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      costPerLiter: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // O CASCADE si eliminar una estación elimina sus facturas
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 7. Crear la tabla 'fuel_types'
    await queryInterface.createTable('fuel_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      costPerLiter: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 8. Crear la tabla 'sale_type_configs'
    await queryInterface.createTable('sale_type_configs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fuelTypeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'fuel_types', key: 'id' }, 
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      saleTypeName: {
        type: Sequelize.ENUM(...SALE_TYPE_NAME_ENUM_VALUES),
        allowNull: false,
      },
      salePricePerLiter: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
      },
      percentage: {
        type: Sequelize.DECIMAL(3, 2), // Porcentaje, ej. 99.99
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 8.2 Añade el índice único compuesto para 'sale_type_configs'
    await queryInterface.addConstraint('sale_type_configs', {
      fields: ['gasStationId', 'fuelTypeId', 'saleTypeName'],
      type: 'unique',
      name: 'unique_station_fuel_sale_config',
    });

    // 9. Crear la tabla 'tank_models'
    await queryInterface.createTable('tank_models', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      nominalCapacity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      shape: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lengthCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      diameterCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      widthCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      heightCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 10. Crear la tabla 'tank_calibration_entries'
    await queryInterface.createTable('tank_calibration_entries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      tankModelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tank_models', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      heightCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      volumeLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 10.2 Añade el índice único compuesto para 'tank_calibration_entries'
    await queryInterface.addConstraint('tank_calibration_entries', {
      fields: ['tankModelId', 'heightCm'],
      type: 'unique',
      name: 'unique_calibration_entry_per_model_height',
    });

    // 11 Crear la tabla 'tanks'
    await queryInterface.createTable('tanks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fuelTypeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'fuel_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tankModelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tank_models', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Se agregará un constraint compuesto más abajo
      },
      currentHeightCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currentVolumeLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      maxCapacityLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      minOperatingVolumeLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 11.2 Añade el constraint único compuesto para 'tanks'
    await queryInterface.addConstraint('tanks', {
      fields: ['gasStationId', 'name'],
      type: 'unique',
      name: 'unique_tank_name_per_station',
    });

    // 12 Crear la tabla 'dispatch_receptions'
    await queryInterface.createTable('dispatch_receptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      invoiceId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tankId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tanks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      receivedLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      receptionDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      initialTankReadingCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      finalTankReadingCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      initialTankVolumeLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      finalTankVolumeLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 12.2 Añade el constraint único compuesto para 'dispatch_receptions'
    await queryInterface.addConstraint('dispatch_receptions', {
      fields: ['invoiceId', 'tankId'],
      type: 'unique',
      name: 'unique_dispatch_reception_per_invoice_tank',
    });

    // 13 Crear la tabla 'tank_assignments'
    await queryInterface.createTable('tank_assignments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      dispatchReceptionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'dispatch_receptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assignedLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      unitPrice: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
      },
      assignedDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 14 Crear la tabla 'pump_islands'
    await queryInterface.createTable('pump_islands', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 14.2 Añade el constraint único compuesto para 'pump_islands'
    await queryInterface.addConstraint('pump_islands', {
      fields: ['gasStationId', 'name'],
      type: 'unique',
      name: 'unique_pump_island_name_per_station',
    });

    // 15 Crear la tabla 'dispensers'
    await queryInterface.createTable('dispensers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pumpIslandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pump_islands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tankId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tanks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fuelTypeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'fuel_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      isOperational: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 15.2 Añade el constraint único compuesto para 'dispensers'
    await queryInterface.addConstraint('dispensers', {
      fields: ['gasStationId', 'name'],
      type: 'unique',
      name: 'unique_dispenser_name_per_station',
    });

    // 16 Crear la tabla 'dispenser_nozzles'
    await queryInterface.createTable('dispenser_nozzles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      dispenserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'dispensers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      initialMeterReading: {
        type: Sequelize.DECIMAL(18, 2), // Precisión para el odómetro
        allowNull: false,
      },
      currentMeterReading: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      isOperational: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 16.2 Añade el constraint único compuesto para 'dispenser_nozzles'
    await queryInterface.addConstraint('dispenser_nozzles', {
      fields: ['dispenserId', 'name'],
      type: 'unique',
      name: 'unique_nozzle_name_per_dispenser',
    });

    // 17 Crear la tabla 'employee_shifts'
    await queryInterface.createTable('employee_shifts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      employeeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      gasStationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'gas_stations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      shiftStartTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      shiftEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      employeeRole: {
        type: Sequelize.ENUM(...EMPLOYEE_ROLE_ENUM_VALUES), // Pasas los valores directamente aquí
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 18 Crear la tabla 'dispenser_readings'
    await queryInterface.createTable('dispenser_readings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      dispenserNozzleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'dispenser_nozzles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      employeeShiftId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'employee_shifts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      readingTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      meterReading: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      readingType: {
        type: Sequelize.ENUM(...READING_TYPE_ENUM_VALUES),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 18.2 Añade el constraint único compuesto para 'dispenser_readings'
    await queryInterface.addConstraint('dispenser_readings', {
      fields: ['dispenserNozzleId', 'employeeShiftId', 'readingType'],
      type: 'unique',
      name: 'unique_reading_per_nozzle_shift_type',
    });

    // 19 Crea la tabla 'sales_tickets'
    await queryInterface.createTable('sales_tickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      ticketNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      cashierShiftId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'employee_shifts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      dispatcherEmployeeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      dispenserNozzleId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'dispenser_nozzles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fuelTypeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'fuel_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      requestedLiters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      actualLitersDispatched: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      assignedSaleTypeConfigId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sale_type_configs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      ticketIssueTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      totalAmountExpected: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(...SALES_TICKET_STATUS_ENUM_VALUES),
        allowNull: false,
        defaultValue: "Pending Payment and Dispatch", // 'Pendiente Despacho y Pago'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 20 Crea la tabla 'payments'
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      salesTicketId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sales_tickets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      paymentMethod: {
        type: Sequelize.ENUM(...PAYMENT_METHOD_ENUM_VALUES), // Usa el tipo ENUM creado
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      paymentTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      transactionReference: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      currencyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'currencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 21 Crea la tabla 'tank_measurements'! ---
    await queryInterface.createTable('tank_measurements', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      tankId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tanks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      employeeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      measurementTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      manualLevelReadingCm: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      volumeInLiters: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      measurementReason: {
        type: Sequelize.ENUM(...MEASUREMENT_REASON_ENUM_VALUES), // Use the created ENUM type
        allowNull: false,
      },
      dispensedVolumeSinceLastMeasurement: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      receivedVolumeSinceLastMeasurement: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    
  },

  /**
   * Método `down` para revertir la migración (eliminar tablas)
   * @param {import('sequelize').QueryInterface} queryInterface
   * @param {import('sequelize').Sequelize} Sequelize
   */
  down: async (queryInterface, Sequelize) => {
    // El orden de eliminación es inverso al de creación para manejar las claves foráneas
    
    await queryInterface.dropTable('tank_measurements');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('sales_tickets');
    await queryInterface.removeConstraint('dispenser_readings', 'unique_reading_per_nozzle_shift_type');
    await queryInterface.dropTable('dispenser_readings');
    await queryInterface.dropTable('employee_shifts');
    await queryInterface.removeConstraint('dispenser_nozzles', 'unique_nozzle_name_per_dispenser');
    await queryInterface.dropTable('dispenser_nozzles');
    await queryInterface.removeConstraint('dispensers', 'unique_dispenser_name_per_station');
    await queryInterface.dropTable('dispensers');
    await queryInterface.removeConstraint('pump_islands', 'unique_pump_island_name_per_station');
    await queryInterface.dropTable('pump_islands');
    await queryInterface.dropTable('tank_assignments');
    await queryInterface.removeConstraint('dispatch_receptions', 'unique_dispatch_reception_per_invoice_tank');
    await queryInterface.dropTable('dispatch_receptions');
    await queryInterface.removeConstraint('tanks', 'unique_tank_name_per_station');
    await queryInterface.dropTable('tanks');
    await queryInterface.removeConstraint('tank_calibration_entries', 'unique_calibration_entry_per_model_height');
    await queryInterface.dropTable('tank_calibration_entries');
    await queryInterface.dropTable('tank_models');
    await queryInterface.removeConstraint('sale_type_configs', 'unique_station_fuel_sale_config');
    await queryInterface.dropTable('sale_type_configs');
    await queryInterface.dropTable('fuel_types');
    await queryInterface.dropTable('invoices');
    await queryInterface.dropTable('employees');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('currencies');
    await queryInterface.dropTable('gas_stations');
    await queryInterface.dropTable('companies');

    // Nota: Los tipos ENUM creados por Sequelize (ej. enum_users_role)
    // no se eliminan automáticamente con dropTable.
    // Si necesitas eliminarlos en un `down` (por ejemplo, para una limpieza completa en desarrollo),
    // tendrías que usar queryInterface.sequelize.query para ejecutar comandos SQL directos:
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_userType";');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  }
};