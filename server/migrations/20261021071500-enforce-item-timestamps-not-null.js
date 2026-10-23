"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // NULLの補完値は決めず、既存NULLがあればPostgreSQLの制約検査で中断する。
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item" ALTER COLUMN "createdAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET NOT NULL',
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item" ALTER COLUMN "updatedAt" DROP NOT NULL, ALTER COLUMN "createdAt" DROP NOT NULL',
                { transaction },
            );
        });
    },
};
