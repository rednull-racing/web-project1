"use strict";

const changes = [
    {
        table: "brands",
        column: "name_normalized",
        fill: "",
    },
    {
        table: "categories",
        column: "layer",
        fill: "",
    },
    {
        table: "categories",
        column: "path",
        fill: "",
    },
    {
        table: "comment",
        column: "pin",
        fill: false,
    },
    {
        table: "notification",
        column: "type",
        fill: "",
    },
    {
        table: "points_history",
        column: "reason_id",
        fill: 0,
    },
    {
        table: "shop_info",
        column: "auto_trans",
        fill: false,
    },
    {
        table: "shop_info",
        column: "open_info",
        fill: false,
    },
    {
        table: "shop_info",
        column: "request_all",
        fill: false,
    },
    {
        table: "shop_info",
        column: "verified",
        fill: false,
    },
    {
        table: "uriagekin_history",
        column: "reason_id",
        fill: 0,
    },
    {
        table: "watch_history",
        column: "user_id",
        fill: 0,
    },
];

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        const { sequelize, queryGenerator } = queryInterface;
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await sequelize.query("SET LOCAL statement_timeout = '60s'", { transaction });
            for (const { table, column, fill } of changes) {
                const quotedTable = queryGenerator.quoteTable({ schema: "public", tableName: table });
                const quotedColumn = queryGenerator.quoteIdentifier(column);
                await sequelize.query(`LOCK TABLE ${quotedTable} IN ACCESS EXCLUSIVE MODE`, { transaction });
                // NULLだけを指定の型別値で補完し、既存の非NULL値と他制約を保持する。
                await sequelize.query(
                    `UPDATE ${quotedTable} SET ${quotedColumn} = :fill WHERE ${quotedColumn} IS NULL`,
                    { replacements: { fill }, transaction },
                );
                await sequelize.query(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} SET NOT NULL`, {
                    transaction,
                });
            }
        });
    },

    async down(queryInterface) {
        const { sequelize, queryGenerator } = queryInterface;
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            for (const { table, column } of [...changes].reverse()) {
                const quotedTable = queryGenerator.quoteTable({ schema: "public", tableName: table });
                const quotedColumn = queryGenerator.quoteIdentifier(column);
                await sequelize.query(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} DROP NOT NULL`, {
                    transaction,
                });
            }
            // downはNULL制約を復元する。補完済みのデータ値は元へ戻さない。
        });
    },
};
