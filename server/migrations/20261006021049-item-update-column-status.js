"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('ALTER TABLE "item" ALTER COLUMN "status" DROP DEFAULT;', { transaction });
            await queryInterface.sequelize.query('ALTER TYPE "item_status" RENAME TO "item_status_old";', { transaction });
            await queryInterface.sequelize.query(`CREATE TYPE "item_status" AS ENUM ('active', 'soldout');`, { transaction });
            // 削除対象の値が残っている場合はキャストで失敗し、全変更をロールバックする。
            await queryInterface.sequelize.query(
                'ALTER TABLE "item" ALTER COLUMN "status" TYPE "item_status" USING "status"::text::"item_status";',
                { transaction },
            );
            await queryInterface.sequelize.query(`ALTER TABLE "item" ALTER COLUMN "status" SET DEFAULT 'active'::"item_status";`, {
                transaction,
            });
            await queryInterface.sequelize.query('DROP TYPE "item_status_old";', { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('ALTER TABLE "item" ALTER COLUMN "status" DROP DEFAULT;', { transaction });
            await queryInterface.sequelize.query('ALTER TYPE "item_status" RENAME TO "item_status_old";', { transaction });
            await queryInterface.sequelize.query(
                `CREATE TYPE "item_status" AS ENUM ('editing', 'draft', 'active', 'hidden', 'soldout', 'deleted');`,
                { transaction },
            );
            await queryInterface.sequelize.query(
                'ALTER TABLE "item" ALTER COLUMN "status" TYPE "item_status" USING "status"::text::"item_status";',
                { transaction },
            );
            await queryInterface.sequelize.query(`ALTER TABLE "item" ALTER COLUMN "status" SET DEFAULT 'editing'::"item_status";`, {
                transaction,
            });
            await queryInterface.sequelize.query('DROP TYPE "item_status_old";', { transaction });
        });
    },
};
