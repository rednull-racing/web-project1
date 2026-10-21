"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // 既存の外部キー制約を維持し、NULL制約のみを変更する。
            await queryInterface.sequelize.query('ALTER TABLE "item_editing" ALTER COLUMN "item_id" DROP NOT NULL;', {
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('ALTER TABLE "item_editing" ALTER COLUMN "item_id" SET NOT NULL;', {
                transaction,
            });
        });
    },
};
