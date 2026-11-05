"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // Sequelize 6はREFERENCES付きchangeColumnでDROP NOT NULLを省略するため、明示的に解除する。
            await queryInterface.sequelize.query(
                'ALTER TABLE "purchase_session" ALTER COLUMN "item_id" DROP NOT NULL',
                { transaction },
            );
            await queryInterface.sequelize.query('ALTER TABLE "item_report" ALTER COLUMN "item_id" DROP NOT NULL', {
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // NULLが存在すれば補正せず失敗させる。
            await queryInterface.sequelize.query('ALTER TABLE "item_report" ALTER COLUMN "item_id" SET NOT NULL', {
                transaction,
            });
            await queryInterface.sequelize.query('ALTER TABLE "purchase_session" ALTER COLUMN "item_id" SET NOT NULL', {
                transaction,
            });
        });
    },
};
