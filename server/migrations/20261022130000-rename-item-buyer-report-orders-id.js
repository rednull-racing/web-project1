"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            // カラム名だけを変更し、既存データとordersへのFK・unique・NULL制約を保持する。
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item_buyer_report" RENAME COLUMN "paid_info_id" TO "orders_id"',
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item_buyer_report" RENAME COLUMN "orders_id" TO "paid_info_id"',
                { transaction },
            );
        });
    },
};
