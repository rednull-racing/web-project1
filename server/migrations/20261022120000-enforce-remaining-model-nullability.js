"use strict";

const columns = [
    ["bank_account", "account_type"],
    ["name", "shop_type"],
    ["transfer", "trans_at"],
];

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        const { sequelize, queryGenerator } = queryInterface;
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await sequelize.query("SET LOCAL statement_timeout = '60s'", { transaction });
            for (const [table] of columns) {
                const quoted = queryGenerator.quoteTable({ schema: "public", tableName: table });
                await sequelize.query(`LOCK TABLE ${quoted} IN ACCESS EXCLUSIVE MODE`, { transaction });
            }
            // 両用途の関連がある場合は独断で優先せず中断する。
            const [conflicts] = await sequelize.query(
                `SELECT n.id FROM public.name n WHERE n.shop_type IS NULL
                 AND (EXISTS (SELECT 1 FROM public.shop_info s WHERE s.name_representative_id = n.id)
                   OR EXISTS (SELECT 1 FROM public.shop_info_edit s WHERE s.name_representative_id = n.id)
                   OR EXISTS (SELECT 1 FROM public.shop_signup s WHERE s.name_representative_id = n.id))
                 AND (EXISTS (SELECT 1 FROM public.shop_info s WHERE s.name_contact_id = n.id)
                   OR EXISTS (SELECT 1 FROM public.shop_info_edit s WHERE s.name_contact_id = n.id)
                   OR EXISTS (SELECT 1 FROM public.shop_signup s WHERE s.name_contact_id = n.id))`,
                { transaction },
            );
            if (conflicts.length > 0) {
                throw new Error("Cannot infer name.shop_type from conflicting relations");
            }
            await sequelize.query(
                "UPDATE public.bank_account SET account_type = 'ordinary' WHERE account_type IS NULL",
                { transaction },
            );
            await sequelize.query(
                `UPDATE public.name n SET shop_type = CASE WHEN
                    EXISTS (SELECT 1 FROM public.shop_info s WHERE s.name_representative_id = n.id)
                    OR EXISTS (SELECT 1 FROM public.shop_info_edit s WHERE s.name_representative_id = n.id)
                    OR EXISTS (SELECT 1 FROM public.shop_signup s WHERE s.name_representative_id = n.id)
                    THEN 'representative' ELSE 'contact' END WHERE n.shop_type IS NULL`,
                { transaction },
            );
            await sequelize.query('UPDATE public.transfer SET trans_at = "createdAt" WHERE trans_at IS NULL', {
                transaction,
            });
            for (const [table, column] of columns) {
                const quotedTable = queryGenerator.quoteTable({ schema: "public", tableName: table });
                const quotedColumn = queryGenerator.quoteIdentifier(column);
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
            for (const [table, column] of [...columns].reverse()) {
                const quotedTable = queryGenerator.quoteTable({ schema: "public", tableName: table });
                const quotedColumn = queryGenerator.quoteIdentifier(column);
                await sequelize.query(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} DROP NOT NULL`, {
                    transaction,
                });
            }
            // 補完済みデータは保持し、適用前のNULL制約だけを復元する。
        });
    },
};
