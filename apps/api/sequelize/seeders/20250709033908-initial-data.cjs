'use strict';

const { DataTypes } = require('sequelize'); // Importa DataTypes si necesitas acceder a ENUMS desde aquí
const { v4: uuidv4 } = require('uuid'); 

// Definiciones de ENUMs (puedes importarlos desde tus modelos si tienes un archivo de index de ENUMs)
// O simplemente re-declararlos si no quieres un acoplamiento profundo con los modelos
const EMPLOYEE_ROLE_ENUM = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
const USER_TYPE_ENUM = ['Administrator', 'Supervisor', 'Cashier', 'FuelAttendant', 'Administrative'];
const SALES_TICKET_STATUS_ENUM = ['Pending Payment and Dispatch', 'Paid - Dispatch Pending', 'Completed', 'Canceled'];
const PAYMENT_METHOD_ENUM = ['Cash', 'Debit Card', 'Credit Card', 'Mobile Payment', 'Transfer'];
const MEASUREMENT_REASON_ENUM = ['Shift Closure', 'Before Reception', 'After Reception', 'Audit', 'Other'];


module.exports = {
  up: async (queryInterface, Sequelize) => {
    // --- COMPANIES ---
    const companyId = uuidv4();
    await queryInterface.bulkInsert('companies', [{
      id: companyId,
      name: 'PetroExpress Corp.',
      address: 'Calle Ficticia 123, Caracas',
      phone: '+582121234567',
      logo: 'http://example.com/logo.png',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- GAS STATIONS ---
    const gasStationId = uuidv4();
    await queryInterface.bulkInsert('gas_stations', [{
      id: gasStationId,
      name: 'Gasolinera Principal',
      code: 'GP001',
      address: 'Av. Libertador, Sector Centro, San Juan de Los Morros',
      companyId: companyId,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- CURRENCIES ---
    const usdId = uuidv4();
    const bsId = uuidv4();
    await queryInterface.bulkInsert('currencies', [
      {
        id: usdId,
        name: 'US Dollar',
        symbol: '$',
        exchangeRate: 36.50, // Tasa de cambio actual (ejemplo)
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: bsId,
        name: 'Bolívar Soberano',
        symbol: 'Bs',
        exchangeRate: 1.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- USERS ---
    const adminUserId = uuidv4();
    const employeeUserId = uuidv4();
    await queryInterface.bulkInsert('users', [
      {
        id: adminUserId,
        username: 'admin.petro',
        passwordHash: '$2a$10$wE7/L6fK.z/f.p.h9P.S.u.e.a.t.e.a.r.t.i.o.n.H', // Reemplaza con un hash real de "password123"
        role: EMPLOYEE_ROLE_ENUM[0], // ADMIN
        userType: USER_TYPE_ENUM[0], // Administrator
        companyId: companyId,
        gasStationId: gasStationId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: employeeUserId,
        username: 'bombero.juan',
        passwordHash: '$2a$10$wE7/L6fK.z/f.p.h9P.S.u.e.a.t.e.a.r.t.i.o.n.H', // Reemplaza con un hash real de "password123"
        role: EMPLOYEE_ROLE_ENUM[2], // EMPLOYEE
        userType: USER_TYPE_ENUM[3], // FuelAttendant
        companyId: companyId,
        gasStationId: gasStationId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- EMPLOYEES ---
    const adminEmployeeId = uuidv4();
    const fuelAttendantEmployeeId = uuidv4();
    await queryInterface.bulkInsert('employees', [
      {
        id: adminEmployeeId,
        userId: adminUserId,
        gasStationId: gasStationId,
        firstName: 'Carlos',
        lastName: 'Pérez',
        position: 'Administrador',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: fuelAttendantEmployeeId,
        userId: employeeUserId,
        gasStationId: gasStationId,
        firstName: 'Juan',
        lastName: 'García',
        position: 'Bombero',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- FUEL TYPES ---
    const gasoline95Id = uuidv4();
    const dieselId = uuidv4();
    await queryInterface.bulkInsert('fuel_types', [
      {
        id: gasoline95Id,
        name: 'Gasoline 95 Octane',
        costPerLiter: 0.10, // Costo de adquisición (ejemplo)
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: dieselId,
        name: 'Diesel',
        costPerLiter: 0.08,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- SALE TYPE CONFIGS ---
    const gasoline95RegularId = uuidv4();
    await queryInterface.bulkInsert('sale_type_configs', [
      {
        id: gasoline95RegularId,
        gasStationId: gasStationId,
        fuelTypeId: gasoline95Id,
        saleTypeName: 'Regular',
        salePricePerLiter: 0.50, // Precio de venta al público (ejemplo)
        percentage: 1.00, // 100% de la venta es de este tipo
        currencyId: usdId, // El precio se define en USD
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- TANK MODELS ---
    const horizontalTankModelId = uuidv4();
    await queryInterface.bulkInsert('tank_models', [{
      id: horizontalTankModelId,
      name: 'Tanque Horizontal 10KL',
      nominalCapacity: 10000.00, // 10,000 litros
      shape: 'Cylindrical Horizontal',
      lengthCm: 500.00,
      diameterCm: 160.00,
      description: 'Tanque cilíndrico horizontal de 10,000 litros.',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- TANK CALIBRATION ENTRIES (ejemplo básico) ---
    await queryInterface.bulkInsert('tank_calibration_entries', [
      {
        id: uuidv4(),
        tankModelId: horizontalTankModelId,
        heightCm: 10.00,
        volumeLiters: 100.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        tankModelId: horizontalTankModelId,
        heightCm: 20.00,
        volumeLiters: 250.00,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        tankModelId: horizontalTankModelId,
        heightCm: 150.00, // Cerca de la capacidad máxima
        volumeLiters: 9800.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});


    // --- TANKS ---
    const tank1Id = uuidv4();
    await queryInterface.bulkInsert('tanks', [
      {
        id: tank1Id,
        gasStationId: gasStationId,
        fuelTypeId: gasoline95Id,
        tankModelId: horizontalTankModelId,
        name: 'Tanque A - Gasolina 95',
        currentHeightCm: 120.00, // Ejemplo
        currentVolumeLiters: 8000.00, // Ejemplo
        maxCapacityLiters: 10000.00,
        minOperatingVolumeLiters: 500.00,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});

    // --- PUMP ISLANDS ---
    const island1Id = uuidv4();
    await queryInterface.bulkInsert('pump_islands', [{
      id: island1Id,
      gasStationId: gasStationId,
      name: 'Isla 1',
      description: 'Isla principal con 2 dispensadores',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- DISPENSERS ---
    const dispenser1Id = uuidv4();
    await queryInterface.bulkInsert('dispensers', [{
      id: dispenser1Id,
      gasStationId: gasStationId,
      pumpIslandId: island1Id,
      tankId: tank1Id,
      fuelTypeId: gasoline95Id,
      name: 'Dispensador 1',
      isOperational: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- DISPENSER NOZZLES ---
    const nozzle1Id = uuidv4();
    await queryInterface.bulkInsert('dispenser_nozzles', [{
      id: nozzle1Id,
      dispenserId: dispenser1Id,
      name: 'Pico 1',
      initialMeterReading: 10000.00, // Lectura inicial de ejemplo
      currentMeterReading: 10000.00,
      isOperational: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- EMPLOYEE SHIFTS ---
    const cashierShiftId = uuidv4();
    const shiftStartTime = new Date();
    shiftStartTime.setHours(8, 0, 0, 0); // Ejemplo: 8:00 AM hoy
    const shiftEndTime = new Date();
    shiftEndTime.setHours(16, 0, 0, 0); // Ejemplo: 4:00 PM hoy

    await queryInterface.bulkInsert('employee_shifts', [{
      id: cashierShiftId,
      employeeId: fuelAttendantEmployeeId, // Asignamos el bombero Juan al turno de cajero (puede ser otro empleado)
      gasStationId: gasStationId,
      shiftStartTime: shiftStartTime,
      shiftEndTime: shiftEndTime,
      employeeRole: USER_TYPE_ENUM[3], // FuelAttendant
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- DISPENSER READINGS (lectura inicial de turno) ---
    await queryInterface.bulkInsert('dispenser_readings', [{
      id: uuidv4(),
      dispenserNozzleId: nozzle1Id,
      employeeShiftId: cashierShiftId,
      readingTime: shiftStartTime,
      meterReading: 10000.00, // Misma que initialMeterReading del pico
      readingType: 'Initial',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- SALES TICKETS (Primer ticket del día) ---
    // El ticketNumber será generado por el hook beforeCreate
    const salesTicket1Id = uuidv4();
    await queryInterface.bulkInsert('sales_tickets', [{
      id: salesTicket1Id,
      gasStationId: gasStationId,
      ticketNumber: 0, // El hook lo actualizará a 1
      cashierShiftId: cashierShiftId,
      dispatcherEmployeeId: fuelAttendantEmployeeId,
      dispenserNozzleId: nozzle1Id,
      fuelTypeId: gasoline95Id,
      requestedLiters: 20.00,
      actualLitersDispatched: 20.00,
      assignedSaleTypeConfigId: gasoline95RegularId,
      ticketIssueTime: new Date(), // Hora actual del ticket
      totalAmountExpected: 20.00 * 0.50, // 20 litros * $0.50/litro
      status: SALES_TICKET_STATUS_ENUM[0], // Pending Payment and Dispatch
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});


    // --- PAYMENTS (Pago para el Sales Ticket 1) ---
    await queryInterface.bulkInsert('payments', [{
      id: uuidv4(),
      salesTicketId: salesTicket1Id,
      paymentMethod: PAYMENT_METHOD_ENUM[0], // Cash
      amount: 10.00, // Total del ticket
      paymentTime: new Date(),
      currencyId: usdId,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    // --- TANK MEASUREMENTS (Medición inicial del tanque) ---
    await queryInterface.bulkInsert('tank_measurements', [{
      id: uuidv4(),
      tankId: tank1Id,
      employeeId: fuelAttendantEmployeeId,
      measurementTime: new Date(), // Hora actual de la medición
      manualLevelReadingCm: 120.00, // Nivel manual
      volumeInLiters: 8000.00, // Volumen calculado
      measurementReason: MEASUREMENT_REASON_ENUM[0], // Shift Closure
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

  },

  down: async (queryInterface, Sequelize) => {
    // --- Eliminar en orden inverso ---
    await queryInterface.bulkDelete('tank_measurements', null, {});
    await queryInterface.bulkDelete('payments', null, {});
    await queryInterface.bulkDelete('sales_tickets', null, {});
    await queryInterface.bulkDelete('dispenser_readings', null, {});
    await queryInterface.bulkDelete('employee_shifts', null, {});
    await queryInterface.bulkDelete('dispenser_nozzles', null, {});
    await queryInterface.bulkDelete('dispensers', null, {});
    await queryInterface.bulkDelete('pump_islands', null, {});
    await queryInterface.bulkDelete('tank_assignments', null, {}); // Si tienes datos aquí
    await queryInterface.bulkDelete('dispatch_receptions', null, {}); // Si tienes datos aquí
    await queryInterface.bulkDelete('tanks', null, {});
    await queryInterface.bulkDelete('tank_calibration_entries', null, {});
    await queryInterface.bulkDelete('tank_models', null, {});
    await queryInterface.bulkDelete('sale_type_configs', null, {});
    await queryInterface.bulkDelete('fuel_types', null, {});
    await queryInterface.bulkDelete('employees', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('currencies', null, {});
    await queryInterface.bulkDelete('gas_stations', null, {});
    await queryInterface.bulkDelete('companies', null, {});
  }
};