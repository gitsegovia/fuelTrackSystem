'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // 1. SalesTicketStatus — tiene datos, requiere conversión
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status DROP DEFAULT`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE TEXT`);
    await q(`UPDATE sales_tickets SET status = 'PENDING_PAYMENT_DISPATCH' WHERE status = 'Pending Payment and Dispatch'`);
    await q(`UPDATE sales_tickets SET status = 'PAID_PENDING_DISPATCH'    WHERE status = 'Paid - Dispatch Pending'`);
    await q(`UPDATE sales_tickets SET status = 'COMPLETED'                WHERE status = 'Completed'`);
    await q(`UPDATE sales_tickets SET status = 'CANCELED'                 WHERE status = 'Canceled'`);
    await q(`DROP TYPE IF EXISTS "enum_sales_tickets_status"`);
    await q(`CREATE TYPE "enum_sales_tickets_status" AS ENUM ('PENDING_PAYMENT_DISPATCH','PAID_PENDING_DISPATCH','COMPLETED','CANCELED')`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE "enum_sales_tickets_status" USING status::"enum_sales_tickets_status"`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status SET DEFAULT 'PENDING_PAYMENT_DISPATCH'::"enum_sales_tickets_status"`);

    // 2. PaymentMethod — tabla vacía
    await q(`ALTER TABLE payments ALTER COLUMN "paymentMethod" TYPE TEXT`);
    await q(`DROP TYPE IF EXISTS "enum_payments_paymentMethod"`);
    await q(`CREATE TYPE "enum_payments_paymentMethod" AS ENUM ('CASH','DEBIT_CARD','CREDIT_CARD','MOBILE_PAYMENT','BANK_TRANSFER')`);
    await q(`ALTER TABLE payments ALTER COLUMN "paymentMethod" TYPE "enum_payments_paymentMethod" USING "paymentMethod"::"enum_payments_paymentMethod"`);

    // 3. ReadingType — tabla vacía
    await q(`ALTER TABLE dispenser_readings ALTER COLUMN "readingType" TYPE TEXT`);
    await q(`DROP TYPE IF EXISTS "enum_dispenser_readings_readingType"`);
    await q(`CREATE TYPE "enum_dispenser_readings_readingType" AS ENUM ('INITIAL','FINAL')`);
    await q(`ALTER TABLE dispenser_readings ALTER COLUMN "readingType" TYPE "enum_dispenser_readings_readingType" USING "readingType"::"enum_dispenser_readings_readingType"`);

    // 4. MeasurementReason — tabla vacía
    await q(`ALTER TABLE tank_measurements ALTER COLUMN "measurementReason" TYPE TEXT`);
    await q(`DROP TYPE IF EXISTS "enum_tank_measurements_measurementReason"`);
    await q(`CREATE TYPE "enum_tank_measurements_measurementReason" AS ENUM ('SHIFT_CLOSURE','DISPATCH_RECEPTION','DAILY_CLOSING','AFTER_RECEPTION','INVENTORY_ADJUSTMENT','OTHER')`);
    await q(`ALTER TABLE tank_measurements ALTER COLUMN "measurementReason" TYPE "enum_tank_measurements_measurementReason" USING "measurementReason"::"enum_tank_measurements_measurementReason"`);
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // Espejo del up: el default depende del tipo (hay que quitarlo antes del DROP TYPE) y los
    // datos se devuelven a los valores viejos antes de castear al enum viejo.
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status DROP DEFAULT`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE TEXT`);
    await q(`UPDATE sales_tickets SET status = 'Pending Payment and Dispatch' WHERE status = 'PENDING_PAYMENT_DISPATCH'`);
    await q(`UPDATE sales_tickets SET status = 'Paid - Dispatch Pending'      WHERE status = 'PAID_PENDING_DISPATCH'`);
    await q(`UPDATE sales_tickets SET status = 'Completed'                    WHERE status = 'COMPLETED'`);
    await q(`UPDATE sales_tickets SET status = 'Canceled'                     WHERE status = 'CANCELED'`);
    await q(`DROP TYPE IF EXISTS "enum_sales_tickets_status"`);
    await q(`CREATE TYPE "enum_sales_tickets_status" AS ENUM ('Pending Payment and Dispatch','Paid - Dispatch Pending','Completed','Canceled')`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE "enum_sales_tickets_status" USING status::"enum_sales_tickets_status"`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status SET DEFAULT 'Pending Payment and Dispatch'::"enum_sales_tickets_status"`);

    await q(`ALTER TABLE payments ALTER COLUMN "paymentMethod" TYPE TEXT`);
    await q(`UPDATE payments SET "paymentMethod" = 'Cash'           WHERE "paymentMethod" = 'CASH'`);
    await q(`UPDATE payments SET "paymentMethod" = 'Debit Card'     WHERE "paymentMethod" = 'DEBIT_CARD'`);
    await q(`UPDATE payments SET "paymentMethod" = 'Credit Card'    WHERE "paymentMethod" = 'CREDIT_CARD'`);
    await q(`UPDATE payments SET "paymentMethod" = 'Mobile Payment' WHERE "paymentMethod" = 'MOBILE_PAYMENT'`);
    await q(`UPDATE payments SET "paymentMethod" = 'Bank Transfer'  WHERE "paymentMethod" = 'BANK_TRANSFER'`);
    await q(`DROP TYPE IF EXISTS "enum_payments_paymentMethod"`);
    await q(`CREATE TYPE "enum_payments_paymentMethod" AS ENUM ('Cash','Debit Card','Credit Card','Mobile Payment','Bank Transfer')`);
    await q(`ALTER TABLE payments ALTER COLUMN "paymentMethod" TYPE "enum_payments_paymentMethod" USING "paymentMethod"::"enum_payments_paymentMethod"`);

    await q(`ALTER TABLE dispenser_readings ALTER COLUMN "readingType" TYPE TEXT`);
    await q(`UPDATE dispenser_readings SET "readingType" = 'Initial' WHERE "readingType" = 'INITIAL'`);
    await q(`UPDATE dispenser_readings SET "readingType" = 'Final'   WHERE "readingType" = 'FINAL'`);
    await q(`DROP TYPE IF EXISTS "enum_dispenser_readings_readingType"`);
    await q(`CREATE TYPE "enum_dispenser_readings_readingType" AS ENUM ('Initial','Final')`);
    await q(`ALTER TABLE dispenser_readings ALTER COLUMN "readingType" TYPE "enum_dispenser_readings_readingType" USING "readingType"::"enum_dispenser_readings_readingType"`);

    await q(`ALTER TABLE tank_measurements ALTER COLUMN "measurementReason" TYPE TEXT`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'Shift Closure'        WHERE "measurementReason" = 'SHIFT_CLOSURE'`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'Dispatch Reception'   WHERE "measurementReason" = 'DISPATCH_RECEPTION'`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'Daily Closing'        WHERE "measurementReason" = 'DAILY_CLOSING'`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'After Reception'      WHERE "measurementReason" = 'AFTER_RECEPTION'`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'Inventory Adjustment' WHERE "measurementReason" = 'INVENTORY_ADJUSTMENT'`);
    await q(`UPDATE tank_measurements SET "measurementReason" = 'Other'                WHERE "measurementReason" = 'OTHER'`);
    await q(`DROP TYPE IF EXISTS "enum_tank_measurements_measurementReason"`);
    await q(`CREATE TYPE "enum_tank_measurements_measurementReason" AS ENUM ('Shift Closure','Dispatch Reception','Daily Closing','After Reception','Inventory Adjustment','Other')`);
    await q(`ALTER TABLE tank_measurements ALTER COLUMN "measurementReason" TYPE "enum_tank_measurements_measurementReason" USING "measurementReason"::"enum_tank_measurements_measurementReason"`);
  },
};
