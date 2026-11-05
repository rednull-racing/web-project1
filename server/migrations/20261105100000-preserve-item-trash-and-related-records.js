"use strict";

const removeItemForeignKey = async (queryInterface, table, transaction) => {
    const foreignKeys = await queryInterface.getForeignKeyReferencesForTable(table, { transaction });
    for (const foreignKey of foreignKeys) {
        if (foreignKey.columnName === "item_id") {
            await queryInterface.removeConstraint(table, foreignKey.constraintName, { transaction });
        }
    }
};

const changeItemReference = async (queryInterface, Sequelize, table, options, transaction) => {
    await removeItemForeignKey(queryInterface, table, transaction);
    await queryInterface.changeColumn(table, "item_id", {
        type: Sequelize.INTEGER,
        allowNull: options.allowNull,
        references: { model: "item", key: "id" },
        onUpdate: options.onUpdate,
        onDelete: options.onDelete,
    }, { transaction });
};

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await removeItemForeignKey(queryInterface, "item_trash", transaction);
            await changeItemReference(queryInterface, Sequelize, "orders", {
                allowNull: true, onUpdate: "CASCADE", onDelete: "SET NULL",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "purchase_session", {
                allowNull: true, onUpdate: "CASCADE", onDelete: "SET NULL",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "item_editing", {
                allowNull: true, onUpdate: "NO ACTION", onDelete: "SET NULL",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "item_report", {
                allowNull: true, onUpdate: "CASCADE", onDelete: "NO ACTION",
            }, transaction);
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // NULL・削除済み商品への履歴参照がある場合は、データを補正せず全体をロールバックする。
            await changeItemReference(queryInterface, Sequelize, "item_report", {
                allowNull: false, onUpdate: "CASCADE", onDelete: "NO ACTION",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "item_editing", {
                allowNull: true, onUpdate: "NO ACTION", onDelete: "CASCADE",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "purchase_session", {
                allowNull: false, onUpdate: "CASCADE", onDelete: "CASCADE",
            }, transaction);
            await changeItemReference(queryInterface, Sequelize, "orders", {
                allowNull: true, onUpdate: "CASCADE", onDelete: "NO ACTION",
            }, transaction);
            await queryInterface.addConstraint("item_trash", {
                fields: ["item_id"],
                type: "foreign key",
                name: "item_trash_item_id_fkey",
                references: { table: "item", field: "id" },
                onUpdate: "NO ACTION",
                onDelete: "CASCADE",
                transaction,
            });
        });
    },
};
