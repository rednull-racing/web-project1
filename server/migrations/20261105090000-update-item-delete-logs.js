"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const foreignKeys = await queryInterface.getForeignKeyReferencesForTable("item_delete_logs", {
                transaction,
            });
            for (const foreignKey of foreignKeys) {
                if (["item_id", "delete_user_id"].includes(foreignKey.columnName)) {
                    await queryInterface.removeConstraint("item_delete_logs", foreignKey.constraintName, {
                        transaction,
                    });
                }
            }
            await queryInterface.changeColumn(
                "item_delete_logs",
                "delete_user_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: "user", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "NO ACTION",
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "item_delete_logs",
                "item_deleted_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: "item_deleted", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "NO ACTION",
                },
                { transaction },
            );
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn("item_delete_logs", "item_deleted_id", { transaction });
            await queryInterface.removeConstraint("item_delete_logs", "item_delete_logs_delete_user_id_fkey", {
                transaction,
            });
            // NULLや削除済みitemへの参照がある場合は、データを補正せず全体をロールバックする。
            await queryInterface.changeColumn(
                "item_delete_logs",
                "delete_user_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: "user", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "NO ACTION",
                },
                { transaction },
            );
            await queryInterface.addConstraint("item_delete_logs", {
                fields: ["item_id"],
                type: "foreign key",
                name: "item_delete_logs_item_id_fkey",
                references: { table: "item", field: "id" },
                onUpdate: "CASCADE",
                onDelete: "NO ACTION",
                transaction,
            });
        });
    },
};
