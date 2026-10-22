"use strict";

const tables = [
    "address",
    "bank_account",
    "blog",
    "cancel",
    "cart",
    "chat",
    "comment",
    "comment_like",
    "comment_report",
    "delivery",
    "follow",
    "id_card",
    "inquiry",
    "item_buyer_report",
    "item_delete_logs",
    "item_deleted",
    "item_like",
    "item_report",
    "item_shipping_profile",
    "journal",
    "name",
    "notification",
    "order_deleted",
    "orders",
    "points_history",
    "reference_code",
    "sale",
    "sales_history",
    "search",
    "shop_info",
    "shop_info_edit",
    "star_history",
    "suggest_words",
    "transfer",
    "uriagekin_history",
    "user_delete_logs",
    "video",
    "watch_history",
];

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        const { sequelize, queryGenerator } = queryInterface;
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await sequelize.query("SET LOCAL statement_timeout = '60s'", { transaction });
            for (const table of tables) {
                const quoted = queryGenerator.quoteTable({ schema: "public", tableName: table });
                await sequelize.query(`LOCK TABLE ${quoted} IN ACCESS EXCLUSIVE MODE`, { transaction });
                // ユーザー指定の補完元を使用。createdAtもNULLなら後続の制約検査で全体を中断する。
                await sequelize.query(
                    `UPDATE ${quoted} SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL`,
                    { transaction },
                );
                await sequelize.query(
                    `ALTER TABLE ${quoted} ALTER COLUMN "createdAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET NOT NULL`,
                    { transaction },
                );
            }
        });
    },

    async down(queryInterface) {
        const { sequelize, queryGenerator } = queryInterface;
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            for (const table of [...tables].reverse()) {
                const quoted = queryGenerator.quoteTable({ schema: "public", tableName: table });
                await sequelize.query(
                    `ALTER TABLE ${quoted} ALTER COLUMN "updatedAt" DROP NOT NULL, ALTER COLUMN "createdAt" DROP NOT NULL`,
                    { transaction },
                );
            }
            // 補完前のNULL行を永続的に記録しないため、downは日時値をNULLに戻さない。
        });
    },
};
