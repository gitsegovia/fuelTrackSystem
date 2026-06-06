'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function daysAgo(n, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function minutesAfter(date, m) {
  return new Date(date.getTime() + m * 60_000);
}

const ts = () => new Date();

// ─── ENUMS (deben coincidir con utils/types.ts) ────────────────────────────────

const UserRole       = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', EMPLOYEE: 'EMPLOYEE' };
const UserType       = { ADMINISTRATOR: 'Administrator', SUPERVISOR: 'Supervisor', CASHIER: 'Cashier', FUEL_ATTENDANT: 'FuelAttendant' };
const EmployeeRole   = { CASHIER: 'CASHIER', DISPATCHER: 'DISPATCHER', MANAGER: 'MANAGER' };
const ReadingType    = { INITIAL: 'INITIAL', FINAL: 'FINAL' };
const TicketStatus   = { PENDING: 'PENDING_PAYMENT_DISPATCH', PAID_PENDING: 'PAID_PENDING_DISPATCH', COMPLETED: 'COMPLETED', CANCELED: 'CANCELED' };
const PaymentMethod  = { CASH: 'CASH', DEBIT_CARD: 'DEBIT_CARD', MOBILE_PAYMENT: 'MOBILE_PAYMENT', BANK_TRANSFER: 'BANK_TRANSFER' };
const MeasureReason  = { SHIFT_CLOSURE: 'SHIFT_CLOSURE', AFTER_RECEPTION: 'AFTER_RECEPTION' };
const FuelKind       = { G91: 'GASOLINE_91', G95: 'GASOLINE_95', DIESEL: 'DIESEL' };
const SaleType       = { REGULAR: 'REGULAR', PREMIUM: 'PREMIUM' };
const InvPayMethod   = { BANK_TRANSFER: 'BANK_TRANSFER', CHECK: 'CHECK' };

module.exports = {
  up: async (queryInterface) => {

    // ── PASSWORD ──────────────────────────────────────────────────────────────
    // Contraseña para todos los usuarios demo: Demo1234!
    const PWD = bcrypt.hashSync('Demo1234!', 10);

    // ─────────────────────────────────────────────────────────────────────────
    // IDs fijos — deterministas para que down() sea confiable si se necesita
    // ─────────────────────────────────────────────────────────────────────────

    // Empresa
    const companyId = uuidv4();

    // Estaciones
    const stNorteId = uuidv4();
    const stSurId   = uuidv4();

    // Monedas
    const usdId = uuidv4();
    const vesId = uuidv4();

    // Tipos de combustible
    const fuel91Id     = uuidv4();
    const fuel95Id     = uuidv4();
    const fuelDieselId = uuidv4();

    // Modelos de tanque
    const model10kId = uuidv4();
    const model20kId = uuidv4();

    // Usuarios
    const uAdmin     = uuidv4();
    const uMgrNorte  = uuidv4();
    const uMgrSur    = uuidv4();
    const uCajNorte  = uuidv4();
    const uCajSur    = uuidv4();
    const uBom1Norte = uuidv4();
    const uBom2Norte = uuidv4();
    const uBom1Sur   = uuidv4();

    // Empleados (mirrors de los usuarios)
    const eAdmin     = uuidv4();
    const eMgrNorte  = uuidv4();
    const eMgrSur    = uuidv4();
    const eCajNorte  = uuidv4();
    const eCajSur    = uuidv4();
    const eBom1Norte = uuidv4();
    const eBom2Norte = uuidv4();
    const eBom1Sur   = uuidv4();

    // Tanques Norte
    const tkN95Id    = uuidv4();
    const tkN91Id    = uuidv4();
    const tkNDslId   = uuidv4();
    // Tanques Sur
    const tkS95Id    = uuidv4();
    const tkSDslId   = uuidv4();

    // Islas Norte
    const islN1Id = uuidv4();
    const islN2Id = uuidv4();
    // Islas Sur
    const islS1Id = uuidv4();
    const islS2Id = uuidv4();

    // Dispensadores Norte
    const dspN1Id = uuidv4(); // isla 1, G95
    const dspN2Id = uuidv4(); // isla 1, G91
    const dspN3Id = uuidv4(); // isla 2, Diesel
    const dspN4Id = uuidv4(); // isla 2, G95
    // Dispensadores Sur
    const dspS1Id = uuidv4(); // isla 1, G95
    const dspS2Id = uuidv4(); // isla 1, Diesel
    const dspS3Id = uuidv4(); // isla 2, G95

    // Boquillas (1 por dispensador)
    const nzN1Id = uuidv4();
    const nzN2Id = uuidv4();
    const nzN3Id = uuidv4();
    const nzN4Id = uuidv4();
    const nzS1Id = uuidv4();
    const nzS2Id = uuidv4();
    const nzS3Id = uuidv4();

    // Configs de precio
    const stcN95Reg  = uuidv4();
    const stcN95Prem = uuidv4();
    const stcN91Reg  = uuidv4();
    const stcNDslReg = uuidv4();
    const stcS95Reg  = uuidv4();
    const stcS95Prem = uuidv4();
    const stcS91Reg  = uuidv4();
    const stcSDslReg = uuidv4();

    // Turnos históricos Norte (cerrados)
    const shN1 = uuidv4(); // día -7
    const shN2 = uuidv4(); // día -5
    const shN3 = uuidv4(); // día -3
    const shNActive = uuidv4(); // activo hoy
    // Turnos históricos Sur (cerrados)
    const shS1 = uuidv4();
    const shS2 = uuidv4();
    const shS3 = uuidv4();
    const shSActive = uuidv4();

    // Facturas
    const inv1 = uuidv4(); // Norte, G95, cerrada
    const inv2 = uuidv4(); // Norte, Diesel, pendiente
    const inv3 = uuidv4(); // Sur, G95, cerrada
    const inv4 = uuidv4(); // Sur, Diesel, pendiente

    // ═════════════════════════════════════════════════════════════════════════
    // 1. EMPRESA
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('companies', [{
      id: companyId,
      name: 'PetroNorte S.A.',
      address: 'Av. Principal, Torre Empresarial Norte, Piso 8, Caracas',
      phone: '+582122345678',
      logo: null,
      createdAt: ts(), updatedAt: ts()
    }]);

    // ═════════════════════════════════════════════════════════════════════════
    // 2. ESTACIONES
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('gas_stations', [
      {
        id: stNorteId,
        name: 'Estación Norte',
        code: 'EST-NORTE-001',
        address: 'Av. Bolívar, Km 5, Sector Centro, Caracas',
        companyId,
        createdAt: ts(), updatedAt: ts()
      },
      {
        id: stSurId,
        name: 'Estación Sur',
        code: 'EST-SUR-002',
        address: 'Calle 8, Zona Industrial, La Victoria, Aragua',
        companyId,
        createdAt: ts(), updatedAt: ts()
      }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 3. MONEDAS
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('currencies', [
      { id: usdId, name: 'Dólar Estadounidense', symbol: '$',  exchangeRate: 1.00,  createdAt: ts(), updatedAt: ts() },
      { id: vesId, name: 'Bolívar',              symbol: 'Bs', exchangeRate: 36.50, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 4. TIPOS DE COMBUSTIBLE
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('fuel_types', [
      { id: fuel91Id,     name: 'Gasolina 91 Octanos', costPerLiter: 0.09, createdAt: ts(), updatedAt: ts() },
      { id: fuel95Id,     name: 'Gasolina 95 Octanos', costPerLiter: 0.12, createdAt: ts(), updatedAt: ts() },
      { id: fuelDieselId, name: 'Diesel',              costPerLiter: 0.08, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 5. USUARIOS
    // Contraseña: Demo1234!
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('users', [
      { id: uAdmin,     username: 'admin.petronorte', passwordHash: PWD, role: UserRole.ADMIN,    userType: UserType.ADMINISTRATOR,  companyId, gasStationId: null,    createdAt: ts(), updatedAt: ts() },
      { id: uMgrNorte,  username: 'mgr.norte',        passwordHash: PWD, role: UserRole.MANAGER,  userType: UserType.SUPERVISOR,      companyId, gasStationId: stNorteId, createdAt: ts(), updatedAt: ts() },
      { id: uMgrSur,    username: 'mgr.sur',          passwordHash: PWD, role: UserRole.MANAGER,  userType: UserType.SUPERVISOR,      companyId, gasStationId: stSurId,   createdAt: ts(), updatedAt: ts() },
      { id: uCajNorte,  username: 'cajero.norte',     passwordHash: PWD, role: UserRole.EMPLOYEE, userType: UserType.CASHIER,          companyId, gasStationId: stNorteId, createdAt: ts(), updatedAt: ts() },
      { id: uCajSur,    username: 'cajero.sur',       passwordHash: PWD, role: UserRole.EMPLOYEE, userType: UserType.CASHIER,          companyId, gasStationId: stSurId,   createdAt: ts(), updatedAt: ts() },
      { id: uBom1Norte, username: 'bombero1.norte',   passwordHash: PWD, role: UserRole.EMPLOYEE, userType: UserType.FUEL_ATTENDANT,  companyId, gasStationId: stNorteId, createdAt: ts(), updatedAt: ts() },
      { id: uBom2Norte, username: 'bombero2.norte',   passwordHash: PWD, role: UserRole.EMPLOYEE, userType: UserType.FUEL_ATTENDANT,  companyId, gasStationId: stNorteId, createdAt: ts(), updatedAt: ts() },
      { id: uBom1Sur,   username: 'bombero1.sur',     passwordHash: PWD, role: UserRole.EMPLOYEE, userType: UserType.FUEL_ATTENDANT,  companyId, gasStationId: stSurId,   createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 6. EMPLEADOS
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('employees', [
      { id: eAdmin,     userId: uAdmin,     gasStationId: stNorteId, firstName: 'Ricardo', lastName: 'Montero',  position: 'Administrador General', createdAt: ts(), updatedAt: ts() },
      { id: eMgrNorte,  userId: uMgrNorte,  gasStationId: stNorteId, firstName: 'Laura',   lastName: 'Jiménez',  position: 'Supervisora Norte',     createdAt: ts(), updatedAt: ts() },
      { id: eMgrSur,    userId: uMgrSur,    gasStationId: stSurId,   firstName: 'Carlos',  lastName: 'Rondón',   position: 'Supervisor Sur',        createdAt: ts(), updatedAt: ts() },
      { id: eCajNorte,  userId: uCajNorte,  gasStationId: stNorteId, firstName: 'María',   lastName: 'Torres',   position: 'Cajera',                createdAt: ts(), updatedAt: ts() },
      { id: eCajSur,    userId: uCajSur,    gasStationId: stSurId,   firstName: 'Pedro',   lastName: 'Salazar',  position: 'Cajero',                createdAt: ts(), updatedAt: ts() },
      { id: eBom1Norte, userId: uBom1Norte, gasStationId: stNorteId, firstName: 'José',    lastName: 'García',   position: 'Bombero',               createdAt: ts(), updatedAt: ts() },
      { id: eBom2Norte, userId: uBom2Norte, gasStationId: stNorteId, firstName: 'Luis',    lastName: 'Herrera',  position: 'Bombero',               createdAt: ts(), updatedAt: ts() },
      { id: eBom1Sur,   userId: uBom1Sur,   gasStationId: stSurId,   firstName: 'Ana',     lastName: 'Díaz',     position: 'Bombexa',               createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 7. MODELOS DE TANQUE
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('tank_models', [
      { id: model10kId, name: 'Cilíndrico Horizontal 10KL', nominalCapacity: 10000, shape: 'Cylindrical Horizontal', lengthCm: 500, diameterCm: 160, widthCm: null, heightCm: null, description: 'Tanque cilíndrico horizontal de 10,000 litros.', createdAt: ts(), updatedAt: ts() },
      { id: model20kId, name: 'Cilíndrico Horizontal 20KL', nominalCapacity: 20000, shape: 'Cylindrical Horizontal', lengthCm: 800, diameterCm: 200, widthCm: null, heightCm: null, description: 'Tanque cilíndrico horizontal de 20,000 litros.', createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 8. TABLAS DE CALIBRACIÓN (nivel cm → volumen litros)
    // ═════════════════════════════════════════════════════════════════════════
    const cal10k = [
      [0,0],[10,120],[20,310],[30,570],[40,880],[50,1230],[60,1630],[70,2060],
      [80,2520],[90,3010],[100,3500],[110,4000],[120,4500],[130,5000],[140,5500],
      [150,6000],[160,6500],[170,7000],[180,7400],[190,7750],[200,8000],
      [210,8200],[220,8400],[230,8600],[240,8800],[250,9000]
    ];
    const cal20k = [
      [0,0],[10,200],[20,500],[30,900],[40,1400],[50,2000],[60,2700],[70,3500],
      [80,4400],[90,5400],[100,6500],[110,7700],[120,8900],[130,10200],[140,11500],
      [150,12800],[160,14100],[170,15300],[180,16400],[190,17400],[200,18200],
      [210,18900],[220,19400],[230,19700],[240,19900],[250,20000]
    ];

    await queryInterface.bulkInsert('tank_calibration_entries',
      [...cal10k.map(([h,v]) => ({ id: uuidv4(), tankModelId: model10kId, heightCm: h, volumeLiters: v, createdAt: ts(), updatedAt: ts() })),
       ...cal20k.map(([h,v]) => ({ id: uuidv4(), tankModelId: model20kId, heightCm: h, volumeLiters: v, createdAt: ts(), updatedAt: ts() }))]
    );

    // ═════════════════════════════════════════════════════════════════════════
    // 9. TANQUES
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('tanks', [
      // Norte
      { id: tkN95Id,  name: 'TK-N-A (G95)',   gasStationId: stNorteId, fuelTypeId: fuel95Id,     tankModelId: model10kId, maxCapacityLiters: 10000, minOperatingVolumeLiters: 500,  currentHeightCm: 130, currentVolumeLiters: 5800, createdAt: ts(), updatedAt: ts() },
      { id: tkN91Id,  name: 'TK-N-B (G91)',   gasStationId: stNorteId, fuelTypeId: fuel91Id,     tankModelId: model10kId, maxCapacityLiters: 10000, minOperatingVolumeLiters: 500,  currentHeightCm: 100, currentVolumeLiters: 3500, createdAt: ts(), updatedAt: ts() },
      { id: tkNDslId, name: 'TK-N-C (Diesel)',gasStationId: stNorteId, fuelTypeId: fuelDieselId,  tankModelId: model20kId, maxCapacityLiters: 20000, minOperatingVolumeLiters: 1000, currentHeightCm: 160, currentVolumeLiters: 14500, createdAt: ts(), updatedAt: ts() },
      // Sur
      { id: tkS95Id,  name: 'TK-S-A (G95)',   gasStationId: stSurId,   fuelTypeId: fuel95Id,     tankModelId: model20kId, maxCapacityLiters: 20000, minOperatingVolumeLiters: 1000, currentHeightCm: 150, currentVolumeLiters: 13200, createdAt: ts(), updatedAt: ts() },
      { id: tkSDslId, name: 'TK-S-B (Diesel)',gasStationId: stSurId,   fuelTypeId: fuelDieselId,  tankModelId: model10kId, maxCapacityLiters: 10000, minOperatingVolumeLiters: 500,  currentHeightCm: 90,  currentVolumeLiters: 3500, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 10. ISLAS
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('pump_islands', [
      { id: islN1Id, gasStationId: stNorteId, name: 'Isla 1', description: 'Gasolina 91 y 95',  createdAt: ts(), updatedAt: ts() },
      { id: islN2Id, gasStationId: stNorteId, name: 'Isla 2', description: 'Diesel y Gasolina 95', createdAt: ts(), updatedAt: ts() },
      { id: islS1Id, gasStationId: stSurId,   name: 'Isla 1', description: 'Gasolina 95 y Diesel', createdAt: ts(), updatedAt: ts() },
      { id: islS2Id, gasStationId: stSurId,   name: 'Isla 2', description: 'Gasolina 95',           createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 11. DISPENSADORES
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('dispensers', [
      // Norte
      { id: dspN1Id, name: 'Surtidor N-1A', gasStationId: stNorteId, pumpIslandId: islN1Id, tankId: tkN95Id,  fuelTypeId: fuel95Id,     isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: dspN2Id, name: 'Surtidor N-1B', gasStationId: stNorteId, pumpIslandId: islN1Id, tankId: tkN91Id,  fuelTypeId: fuel91Id,     isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: dspN3Id, name: 'Surtidor N-2A', gasStationId: stNorteId, pumpIslandId: islN2Id, tankId: tkNDslId, fuelTypeId: fuelDieselId, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: dspN4Id, name: 'Surtidor N-2B', gasStationId: stNorteId, pumpIslandId: islN2Id, tankId: tkN95Id,  fuelTypeId: fuel95Id,     isOperational: true, createdAt: ts(), updatedAt: ts() },
      // Sur
      { id: dspS1Id, name: 'Surtidor S-1A', gasStationId: stSurId,   pumpIslandId: islS1Id, tankId: tkS95Id,  fuelTypeId: fuel95Id,     isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: dspS2Id, name: 'Surtidor S-1B', gasStationId: stSurId,   pumpIslandId: islS1Id, tankId: tkSDslId, fuelTypeId: fuelDieselId, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: dspS3Id, name: 'Surtidor S-2A', gasStationId: stSurId,   pumpIslandId: islS2Id, tankId: tkS95Id,  fuelTypeId: fuel95Id,     isOperational: true, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 12. BOQUILLAS (1 por dispensador)
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('dispenser_nozzles', [
      { id: nzN1Id, dispenserId: dspN1Id, name: 'Pico 1', initialMeterReading: 5000, currentMeterReading: 5000, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzN2Id, dispenserId: dspN2Id, name: 'Pico 1', initialMeterReading: 3200, currentMeterReading: 3200, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzN3Id, dispenserId: dspN3Id, name: 'Pico 1', initialMeterReading: 8700, currentMeterReading: 8700, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzN4Id, dispenserId: dspN4Id, name: 'Pico 1', initialMeterReading: 4100, currentMeterReading: 4100, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzS1Id, dispenserId: dspS1Id, name: 'Pico 1', initialMeterReading: 6300, currentMeterReading: 6300, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzS2Id, dispenserId: dspS2Id, name: 'Pico 1', initialMeterReading: 2900, currentMeterReading: 2900, isOperational: true, createdAt: ts(), updatedAt: ts() },
      { id: nzS3Id, dispenserId: dspS3Id, name: 'Pico 1', initialMeterReading: 4800, currentMeterReading: 4800, isOperational: true, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 13. CONFIGURACIONES DE PRECIO (sale_type_configs)
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('sale_type_configs', [
      // Norte
      { id: stcN95Reg,  gasStationId: stNorteId, fuelTypeId: fuel95Id,     saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.65, percentage: 70, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcN95Prem, gasStationId: stNorteId, fuelTypeId: fuel95Id,     saleTypeName: SaleType.PREMIUM,  salePricePerLiter: 3.20, percentage: 30, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcN91Reg,  gasStationId: stNorteId, fuelTypeId: fuel91Id,     saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.50, percentage: 100, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcNDslReg, gasStationId: stNorteId, fuelTypeId: fuelDieselId, saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.45, percentage: 100, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      // Sur
      { id: stcS95Reg,  gasStationId: stSurId,   fuelTypeId: fuel95Id,     saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.65, percentage: 60, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcS95Prem, gasStationId: stSurId,   fuelTypeId: fuel95Id,     saleTypeName: SaleType.PREMIUM,  salePricePerLiter: 3.20, percentage: 40, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcS91Reg,  gasStationId: stSurId,   fuelTypeId: fuel91Id,     saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.50, percentage: 100, currencyId: usdId, createdAt: ts(), updatedAt: ts() },
      { id: stcSDslReg, gasStationId: stSurId,   fuelTypeId: fuelDieselId, saleTypeName: SaleType.REGULAR,  salePricePerLiter: 0.45, percentage: 100, currencyId: usdId, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 15–16. TURNOS CERRADOS + LECTURAS + TICKETS + PAGOS
    // ═════════════════════════════════════════════════════════════════════════

    // Matriz de nozzles por turno: { nozzleId, initReading, finalReading, fuelTypeId, stcId, price }
    const closedShifts = [
      // ── NORTE ──
      {
        shiftId: shN1, stationId: stNorteId, empId: eCajNorte,
        startTime: daysAgo(7, 6), endTime: daysAgo(7, 14),
        role: EmployeeRole.CASHIER,
        nozzles: [
          { nozzleId: nzN1Id, init: 5000, final: 5310, fuelTypeId: fuel95Id,     stcId: stcN95Reg,  price: 0.65 },
          { nozzleId: nzN2Id, init: 3200, final: 3395, fuelTypeId: fuel91Id,     stcId: stcN91Reg,  price: 0.50 }
        ],
        tickets: 8
      },
      {
        shiftId: shN2, stationId: stNorteId, empId: eCajNorte,
        startTime: daysAgo(5, 6), endTime: daysAgo(5, 14),
        role: EmployeeRole.CASHIER,
        nozzles: [
          { nozzleId: nzN1Id, init: 5310, final: 5670, fuelTypeId: fuel95Id,     stcId: stcN95Reg,  price: 0.65 },
          { nozzleId: nzN3Id, init: 8700, final: 8960, fuelTypeId: fuelDieselId, stcId: stcNDslReg, price: 0.45 }
        ],
        tickets: 9
      },
      {
        shiftId: shN3, stationId: stNorteId, empId: eMgrNorte,
        startTime: daysAgo(3, 6), endTime: daysAgo(3, 14),
        role: EmployeeRole.MANAGER,
        nozzles: [
          { nozzleId: nzN1Id, init: 5670, final: 6050, fuelTypeId: fuel95Id,     stcId: stcN95Reg,  price: 0.65 },
          { nozzleId: nzN4Id, init: 4100, final: 4285, fuelTypeId: fuel95Id,     stcId: stcN95Prem, price: 3.20 }
        ],
        tickets: 7
      },
      // ── SUR ──
      {
        shiftId: shS1, stationId: stSurId, empId: eCajSur,
        startTime: daysAgo(7, 7), endTime: daysAgo(7, 15),
        role: EmployeeRole.CASHIER,
        nozzles: [
          { nozzleId: nzS1Id, init: 6300, final: 6580, fuelTypeId: fuel95Id,     stcId: stcS95Reg,  price: 0.65 },
          { nozzleId: nzS2Id, init: 2900, final: 3090, fuelTypeId: fuelDieselId, stcId: stcSDslReg, price: 0.45 }
        ],
        tickets: 7
      },
      {
        shiftId: shS2, stationId: stSurId, empId: eCajSur,
        startTime: daysAgo(5, 7), endTime: daysAgo(5, 15),
        role: EmployeeRole.CASHIER,
        nozzles: [
          { nozzleId: nzS1Id, init: 6580, final: 6950, fuelTypeId: fuel95Id,     stcId: stcS95Reg,  price: 0.65 },
          { nozzleId: nzS3Id, init: 4800, final: 5025, fuelTypeId: fuel95Id,     stcId: stcS95Prem, price: 3.20 }
        ],
        tickets: 8
      },
      {
        shiftId: shS3, stationId: stSurId, empId: eMgrSur,
        startTime: daysAgo(3, 7), endTime: daysAgo(3, 15),
        role: EmployeeRole.MANAGER,
        nozzles: [
          { nozzleId: nzS1Id, init: 6950, final: 7250, fuelTypeId: fuel95Id,     stcId: stcS95Reg,  price: 0.65 },
          { nozzleId: nzS2Id, init: 3090, final: 3250, fuelTypeId: fuelDieselId, stcId: stcSDslReg, price: 0.45 }
        ],
        tickets: 6
      }
    ];

    const payMethods = [PaymentMethod.CASH, PaymentMethod.DEBIT_CARD, PaymentMethod.MOBILE_PAYMENT, PaymentMethod.BANK_TRANSFER];

    for (const shift of closedShifts) {
      // Turno
      await queryInterface.bulkInsert('employee_shifts', [{
        id: shift.shiftId,
        employeeId: shift.empId,
        gasStationId: shift.stationId,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        employeeRole: shift.role,
        createdAt: ts(), updatedAt: ts()
      }]);

      // Lecturas iniciales
      for (const n of shift.nozzles) {
        await queryInterface.bulkInsert('dispenser_readings', [{
          id: uuidv4(), dispenserNozzleId: n.nozzleId, employeeShiftId: shift.shiftId,
          readingTime: shift.startTime, meterReading: n.init, readingType: ReadingType.INITIAL,
          createdAt: ts(), updatedAt: ts()
        }]);
      }

      // Tickets + pagos
      for (let i = 0; i < shift.tickets; i++) {
        const ticketId = uuidv4();
        const n = shift.nozzles[i % shift.nozzles.length];
        const liters = parseFloat((Math.random() * 55 + 5).toFixed(2));
        const total  = parseFloat((liters * n.price).toFixed(2));
        const issueTime = minutesAfter(shift.startTime, (i + 1) * 50);

        await queryInterface.bulkInsert('sales_tickets', [{
          id: ticketId,
          gasStationId: shift.stationId,
          ticketNumber: i + 1,
          cashierShiftId: shift.shiftId,
          dispatcherEmployeeId: shift.empId,
          dispatcherShiftId: shift.shiftId,
          dispenserNozzleId: n.nozzleId,
          fuelTypeId: n.fuelTypeId,
          requestedLiters: liters,
          actualLitersDispatched: liters,
          assignedSaleTypeConfigId: n.stcId,
          ticketIssueTime: issueTime,
          totalAmountExpected: total,
          status: TicketStatus.COMPLETED,
          createdAt: ts(), updatedAt: ts()
        }]);

        await queryInterface.bulkInsert('payments', [{
          id: uuidv4(),
          salesTicketId: ticketId,
          paymentMethod: payMethods[i % payMethods.length],
          amount: total,
          paymentTime: minutesAfter(issueTime, 3),
          currencyId: usdId,
          exchangeRateAtPayment: 1.00,
          createdAt: ts(), updatedAt: ts()
        }]);
      }

      // Lecturas finales
      for (const n of shift.nozzles) {
        await queryInterface.bulkInsert('dispenser_readings', [{
          id: uuidv4(), dispenserNozzleId: n.nozzleId, employeeShiftId: shift.shiftId,
          readingTime: shift.endTime, meterReading: n.final, readingType: ReadingType.FINAL,
          createdAt: ts(), updatedAt: ts()
        }]);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 17. TURNOS ACTIVOS (sin shiftEndTime)
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('employee_shifts', [
      { id: shNActive, employeeId: eCajNorte, gasStationId: stNorteId, shiftStartTime: daysAgo(0, 6), shiftEndTime: null, employeeRole: EmployeeRole.CASHIER, createdAt: ts(), updatedAt: ts() },
      { id: shSActive, employeeId: eCajSur,   gasStationId: stSurId,   shiftStartTime: daysAgo(0, 7), shiftEndTime: null, employeeRole: EmployeeRole.CASHIER, createdAt: ts(), updatedAt: ts() }
    ]);

    // Lecturas iniciales de turnos activos
    await queryInterface.bulkInsert('dispenser_readings', [
      { id: uuidv4(), dispenserNozzleId: nzN1Id, employeeShiftId: shNActive, readingTime: daysAgo(0, 6), meterReading: 6050, readingType: ReadingType.INITIAL, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), dispenserNozzleId: nzN4Id, employeeShiftId: shNActive, readingTime: daysAgo(0, 6), meterReading: 4285, readingType: ReadingType.INITIAL, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), dispenserNozzleId: nzS1Id, employeeShiftId: shSActive, readingTime: daysAgo(0, 7), meterReading: 7250, readingType: ReadingType.INITIAL, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), dispenserNozzleId: nzS3Id, employeeShiftId: shSActive, readingTime: daysAgo(0, 7), meterReading: 5025, readingType: ReadingType.INITIAL, createdAt: ts(), updatedAt: ts() }
    ]);

    // Tickets del turno activo Norte (mezcla de estados)
    const activeTicketsNorte = [
      { liters: 30, nozzleId: nzN1Id, fuelTypeId: fuel95Id, stcId: stcN95Reg,  price: 0.65, status: TicketStatus.COMPLETED,    num: 1, min: 30 },
      { liters: 20, nozzleId: nzN1Id, fuelTypeId: fuel95Id, stcId: stcN95Reg,  price: 0.65, status: TicketStatus.COMPLETED,    num: 2, min: 65 },
      { liters: 15, nozzleId: nzN4Id, fuelTypeId: fuel95Id, stcId: stcN95Prem, price: 3.20, status: TicketStatus.COMPLETED,    num: 3, min: 100 },
      { liters: 45, nozzleId: nzN1Id, fuelTypeId: fuel95Id, stcId: stcN95Reg,  price: 0.65, status: TicketStatus.PAID_PENDING, num: 4, min: 135 },
      { liters: 60, nozzleId: nzN1Id, fuelTypeId: fuel95Id, stcId: stcN95Reg,  price: 0.65, status: TicketStatus.PENDING,      num: 5, min: 165 }
    ];

    const activeTicketsSur = [
      { liters: 25, nozzleId: nzS1Id, fuelTypeId: fuel95Id, stcId: stcS95Reg,  price: 0.65, status: TicketStatus.COMPLETED, num: 1, min: 30 },
      { liters: 10, nozzleId: nzS3Id, fuelTypeId: fuel95Id, stcId: stcS95Prem, price: 3.20, status: TicketStatus.COMPLETED, num: 2, min: 70 },
      { liters: 50, nozzleId: nzS1Id, fuelTypeId: fuel95Id, stcId: stcS95Reg,  price: 0.65, status: TicketStatus.PENDING,   num: 3, min: 115 }
    ];

    for (const [tickets, shiftId, stationId, empId, startHour] of [
      [activeTicketsNorte, shNActive, stNorteId, eCajNorte, 6],
      [activeTicketsSur,   shSActive, stSurId,   eCajSur,   7]
    ]) {
      for (const t of tickets) {
        const ticketId = uuidv4();
        const total    = parseFloat((t.liters * t.price).toFixed(2));
        const issueTime = minutesAfter(daysAgo(0, startHour), t.min);

        await queryInterface.bulkInsert('sales_tickets', [{
          id: ticketId,
          gasStationId: stationId,
          ticketNumber: t.num,
          cashierShiftId: shiftId,
          dispatcherEmployeeId: empId,
          dispatcherShiftId: shiftId,
          dispenserNozzleId: t.nozzleId,
          fuelTypeId: t.fuelTypeId,
          requestedLiters: t.liters,
          actualLitersDispatched: t.status !== TicketStatus.PENDING ? t.liters : null,
          assignedSaleTypeConfigId: t.stcId,
          ticketIssueTime: issueTime,
          totalAmountExpected: total,
          status: t.status,
          createdAt: ts(), updatedAt: ts()
        }]);

        if (t.status === TicketStatus.COMPLETED || t.status === TicketStatus.PAID_PENDING) {
          await queryInterface.bulkInsert('payments', [{
            id: uuidv4(),
            salesTicketId: ticketId,
            paymentMethod: PaymentMethod.CASH,
            amount: total,
            paymentTime: minutesAfter(issueTime, 2),
            currencyId: usdId,
            exchangeRateAtPayment: 1.00,
            createdAt: ts(), updatedAt: ts()
          }]);
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 18. MEDICIONES DE TANQUE
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('tank_measurements', [
      { id: uuidv4(), tankId: tkN95Id,  employeeId: eMgrNorte, employeeShiftId: shN3, measurementTime: daysAgo(3, 14), manualLevelReadingCm: 130, volumeInLiters: 5800,  measurementReason: MeasureReason.SHIFT_CLOSURE, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), tankId: tkNDslId, employeeId: eMgrNorte, employeeShiftId: shN3, measurementTime: daysAgo(3, 14), manualLevelReadingCm: 160, volumeInLiters: 14500, measurementReason: MeasureReason.SHIFT_CLOSURE, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), tankId: tkS95Id,  employeeId: eMgrSur,   employeeShiftId: shS3, measurementTime: daysAgo(3, 15), manualLevelReadingCm: 150, volumeInLiters: 13200, measurementReason: MeasureReason.SHIFT_CLOSURE, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), tankId: tkSDslId, employeeId: eMgrSur,   employeeShiftId: shS3, measurementTime: daysAgo(3, 15), manualLevelReadingCm: 90,  volumeInLiters: 3500,  measurementReason: MeasureReason.SHIFT_CLOSURE, createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 19. FACTURAS DE PROVEEDOR
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('invoices', [
      { id: inv1, invoiceNumber: 'FAC-2024-001001', controlNumber: 'CTRL-00001', sealNumber: 'SL-00001', liters: 8000, dispatchDate: daysAgo(10, 8), dischargeDate: daysAgo(10, 11), truckPlate: 'ABC-123', tankPlate: 'TK-001', driverName: 'Ramón Blanco',    driverIdNumber: 'V-12345678', fuelType: FuelKind.G95,    totalAmount: 960,  costPerLiter: 0.12, gasStationId: stNorteId, currencyId: usdId, status: 'CLOSED',   createdAt: ts(), updatedAt: ts() },
      { id: inv2, invoiceNumber: 'FAC-2024-001002', controlNumber: 'CTRL-00002', sealNumber: 'SL-00002', liters: 15000, dispatchDate: daysAgo(8, 9), dischargeDate: daysAgo(8, 12),  truckPlate: 'DEF-456', tankPlate: 'TK-002', driverName: 'Héctor Ruiz',     driverIdNumber: 'V-87654321', fuelType: FuelKind.DIESEL, totalAmount: 1200, costPerLiter: 0.08, gasStationId: stNorteId, currencyId: usdId, status: 'PENDING',  createdAt: ts(), updatedAt: ts() },
      { id: inv3, invoiceNumber: 'FAC-2024-002001', controlNumber: 'CTRL-00003', sealNumber: 'SL-00003', liters: 12000, dispatchDate: daysAgo(9, 10), dischargeDate: daysAgo(9, 14), truckPlate: 'GHI-789', tankPlate: 'TK-003', driverName: 'Pedro Vásquez',   driverIdNumber: 'V-11223344', fuelType: FuelKind.G95,    totalAmount: 1440, costPerLiter: 0.12, gasStationId: stSurId,   currencyId: usdId, status: 'CLOSED',   createdAt: ts(), updatedAt: ts() },
      { id: inv4, invoiceNumber: 'FAC-2024-002002', controlNumber: 'CTRL-00004', sealNumber: 'SL-00004', liters: 7000,  dispatchDate: daysAgo(6, 8),  dischargeDate: daysAgo(6, 11),  truckPlate: 'JKL-012', tankPlate: 'TK-004', driverName: 'Carlos Fernández', driverIdNumber: 'V-55667788', fuelType: FuelKind.DIESEL, totalAmount: 560,  costPerLiter: 0.08, gasStationId: stSurId,   currencyId: usdId, status: 'PENDING',  createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 20. RECEPCIONES DE DESPACHO
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('dispatch_receptions', [
      { id: uuidv4(), invoiceId: inv1, tankId: tkN95Id,  receivedLiters: 8000,  receptionDate: daysAgo(10, 11), initialTankReadingCm: 50,  finalTankReadingCm: 130, initialTankVolumeLiters: 1230, finalTankVolumeLiters: 9200,  createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), invoiceId: inv2, tankId: tkNDslId, receivedLiters: 15000, receptionDate: daysAgo(8, 12),  initialTankReadingCm: 80,  finalTankReadingCm: 200, initialTankVolumeLiters: 2000, finalTankVolumeLiters: 18200, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), invoiceId: inv3, tankId: tkS95Id,  receivedLiters: 12000, receptionDate: daysAgo(9, 14),  initialTankReadingCm: 70,  finalTankReadingCm: 175, initialTankVolumeLiters: 3500, finalTankVolumeLiters: 15700, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), invoiceId: inv4, tankId: tkSDslId, receivedLiters: 7000,  receptionDate: daysAgo(6, 11),  initialTankReadingCm: 50,  finalTankReadingCm: 150, initialTankVolumeLiters: 1230, finalTankVolumeLiters: 8200,  createdAt: ts(), updatedAt: ts() }
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // 21. PAGOS DE FACTURAS
    // ═════════════════════════════════════════════════════════════════════════
    await queryInterface.bulkInsert('invoice_payments', [
      // FAC-001: pagada en 2 cuotas
      { id: uuidv4(), invoiceId: inv1, amount: 500.00, paymentDate: daysAgo(9), bankName: 'Banco Venezuela', paymentMethod: InvPayMethod.BANK_TRANSFER, referenceNumber: 'REF-001-A', notes: 'Primer abono',    recordedById: uAdmin, createdAt: ts(), updatedAt: ts() },
      { id: uuidv4(), invoiceId: inv1, amount: 460.00, paymentDate: daysAgo(8), bankName: 'Banco Venezuela', paymentMethod: InvPayMethod.BANK_TRANSFER, referenceNumber: 'REF-001-B', notes: 'Saldo restante',  recordedById: uAdmin, createdAt: ts(), updatedAt: ts() },
      // FAC-002: pago parcial (600 de 1200)
      { id: uuidv4(), invoiceId: inv2, amount: 600.00, paymentDate: daysAgo(7), bankName: 'Banesco',         paymentMethod: InvPayMethod.CHECK,         referenceNumber: 'CHK-00012',  notes: null,             recordedById: uAdmin, createdAt: ts(), updatedAt: ts() },
      // FAC-003: pagada completa
      { id: uuidv4(), invoiceId: inv3, amount: 1440.00, paymentDate: daysAgo(8), bankName: 'BDV',           paymentMethod: InvPayMethod.BANK_TRANSFER, referenceNumber: 'REF-003-A', notes: 'Pago total',      recordedById: uAdmin, createdAt: ts(), updatedAt: ts() }
      // FAC-004: sin pago (pendiente)
    ]);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DOWN — elimina en orden inverso de FKs
  // ─────────────────────────────────────────────────────────────────────────
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('invoice_payments',      null, {});
    await queryInterface.bulkDelete('dispatch_receptions',   null, {});
    await queryInterface.bulkDelete('tank_measurements',     null, {});
    await queryInterface.bulkDelete('payments',              null, {});
    await queryInterface.bulkDelete('sales_tickets',         null, {});
    await queryInterface.bulkDelete('dispenser_readings',    null, {});
    await queryInterface.bulkDelete('employee_shifts',       null, {});
    await queryInterface.bulkDelete('dispenser_nozzles',     null, {});
    await queryInterface.bulkDelete('dispensers',            null, {});
    await queryInterface.bulkDelete('pump_islands',          null, {});
    await queryInterface.bulkDelete('tank_calibration_entries', null, {});
    await queryInterface.bulkDelete('tanks',                 null, {});
    await queryInterface.bulkDelete('tank_models',           null, {});
    await queryInterface.bulkDelete('sale_type_configs',     null, {});
    await queryInterface.bulkDelete('employees',             null, {});
    await queryInterface.bulkDelete('users',                 null, {});
    await queryInterface.bulkDelete('currencies',            null, {});
    await queryInterface.bulkDelete('fuel_types',            null, {});
    await queryInterface.bulkDelete('gas_stations',          null, {});
    await queryInterface.bulkDelete('companies',             null, {});
  }
};
