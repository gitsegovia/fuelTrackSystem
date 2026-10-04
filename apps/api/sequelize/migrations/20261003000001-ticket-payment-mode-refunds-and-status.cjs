'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    const columns = await queryInterface.describeTable('sales_tickets');

    // Las filas que ya existen al correr esta migración son históricas: se despachaban antes de
    // cobrar, así que son POSTPAID. Las filas nuevas toman el DEFAULT 'PREPAID'.
    if (!columns.paymentMode) {
      await q(`DO $$ BEGIN CREATE TYPE "enum_sales_tickets_paymentMode" AS ENUM ('PREPAID','POSTPAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
      await q(`ALTER TABLE sales_tickets ADD COLUMN "paymentMode" "enum_sales_tickets_paymentMode" NOT NULL DEFAULT 'PREPAID'`);
      await q(`UPDATE sales_tickets SET "paymentMode" = 'POSTPAID'`);
    }

    // Precio por litro con el que se calculó el total. Histórico: el total se recalculaba al
    // despachar (actual × precio), así que el precio sale de total / litros despachados; los
    // tickets sin despacho usan los litros pedidos.
    if (!columns.pricePerLiter) {
      await q(`ALTER TABLE sales_tickets ADD COLUMN "pricePerLiter" DECIMAL(18,4)`);
      await q(`
        UPDATE sales_tickets
        SET "pricePerLiter" = ROUND(
          ("totalAmountExpected" / NULLIF(COALESCE(NULLIF("actualLitersDispatched", 0), "requestedLiters"), 0))::numeric,
          4
        )
      `);
      await q(`ALTER TABLE sales_tickets ALTER COLUMN "pricePerLiter" SET NOT NULL`);
    }

    // H-005: PAID_PENDING_DISPATCH se asignaba al despachar (despachado sin pagar) → DISPATCHED.
    const [statusLabels] = await q(`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'enum_sales_tickets_status'
    `);
    if (statusLabels.some((r) => r.enumlabel === 'PENDING_PAYMENT_DISPATCH')) {
      await q(`ALTER TABLE sales_tickets ALTER COLUMN status DROP DEFAULT`);
      await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE TEXT`);
      await q(`UPDATE sales_tickets SET status = 'ISSUED'     WHERE status = 'PENDING_PAYMENT_DISPATCH'`);
      await q(`UPDATE sales_tickets SET status = 'DISPATCHED' WHERE status = 'PAID_PENDING_DISPATCH'`);
      await q(`DROP TYPE IF EXISTS "enum_sales_tickets_status"`);
      await q(`CREATE TYPE "enum_sales_tickets_status" AS ENUM ('ISSUED','PAID','DISPATCHED','COMPLETED','CANCELED')`);
      await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE "enum_sales_tickets_status" USING status::"enum_sales_tickets_status"`);
      await q(`ALTER TABLE sales_tickets ALTER COLUMN status SET DEFAULT 'ISSUED'::"enum_sales_tickets_status"`);
    }

    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tableNames.includes('ticket_refunds')) {
      await queryInterface.createTable('ticket_refunds', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
          primaryKey: true,
          allowNull: false,
        },
        salesTicketId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'sales_tickets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        amount: {
          type: Sequelize.DECIMAL(18, 2),
          allowNull: false,
        },
        currencyId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'currencies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        exchangeRateAtRefund: {
          type: Sequelize.DECIMAL(18, 6),
          allowNull: false,
        },
        paymentMethod: {
          type: Sequelize.ENUM('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'MOBILE_PAYMENT', 'BANK_TRANSFER'),
          allowNull: false,
        },
        recordedById: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        refundedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        notes: {
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
      await queryInterface.addIndex('ticket_refunds', ['salesTicketId'], { name: 'idx_ticket_refunds_sales_ticket' });
    }
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await queryInterface.dropTable('ticket_refunds');
    await q(`DROP TYPE IF EXISTS "enum_ticket_refunds_paymentMethod"`);

    // Espejo del up. PAID no tiene equivalente en el enum viejo: vuelve a PENDING_PAYMENT_DISPATCH
    // (se pierde la distinción prepago-pagado). DISPATCHED vuelve a PAID_PENDING_DISPATCH.
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status DROP DEFAULT`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE TEXT`);
    await q(`UPDATE sales_tickets SET status = 'PENDING_PAYMENT_DISPATCH' WHERE status IN ('ISSUED','PAID')`);
    await q(`UPDATE sales_tickets SET status = 'PAID_PENDING_DISPATCH'    WHERE status = 'DISPATCHED'`);
    await q(`DROP TYPE IF EXISTS "enum_sales_tickets_status"`);
    await q(`CREATE TYPE "enum_sales_tickets_status" AS ENUM ('PENDING_PAYMENT_DISPATCH','PAID_PENDING_DISPATCH','COMPLETED','CANCELED')`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status TYPE "enum_sales_tickets_status" USING status::"enum_sales_tickets_status"`);
    await q(`ALTER TABLE sales_tickets ALTER COLUMN status SET DEFAULT 'PENDING_PAYMENT_DISPATCH'::"enum_sales_tickets_status"`);

    await queryInterface.removeColumn('sales_tickets', 'pricePerLiter');
    await queryInterface.removeColumn('sales_tickets', 'paymentMode');
    await q(`DROP TYPE IF EXISTS "enum_sales_tickets_paymentMode"`);
  },
};
