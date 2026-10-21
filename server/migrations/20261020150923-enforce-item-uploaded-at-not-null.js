"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // 既存NULLはユーザーが指定した作成日時で補完する。
            await queryInterface.sequelize.query(
                'UPDATE "public"."item" SET "uploaded_at" = "createdAt" WHERE "uploaded_at" IS NULL',
                { transaction },
            );
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item" ALTER COLUMN "uploaded_at" SET NOT NULL',
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        // 補完済みの日時は保持し、NULL制約だけを元に戻す。
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(
                'ALTER TABLE "public"."item" ALTER COLUMN "uploaded_at" DROP NOT NULL',
                { transaction },
            );
        });
    },
};
