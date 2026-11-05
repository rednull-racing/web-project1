"use strict";

const relations = [
    {
        table: "item_delete_logs",
        column: "item_deleted_id",
        target: "item_deleted",
        onUpdate: "CASCADE",
        wasNullable: true,
    },
    { table: "item_delete_logs", column: "delete_user_id", target: "user", onUpdate: "CASCADE", wasNullable: true },
    { table: "item_deleted", column: "seller_id", target: "user", onUpdate: "NO ACTION", wasNullable: false },
    { table: "item_deleted", column: "deleted_by", target: "user", onUpdate: "NO ACTION", wasNullable: false },
];

async function changeRelation(queryInterface, Sequelize, relation, reverting, transaction) {
    const { table, column, target, onUpdate, wasNullable } = relation;
    const foreignKeys = await queryInterface.getForeignKeyReferencesForTable(table, { transaction });
    for (const foreignKey of foreignKeys) {
        if (foreignKey.columnName === column) {
            await queryInterface.removeConstraint(table, foreignKey.constraintName, { transaction });
        }
    }
    // NULL制約変更と外部キー追加を分け、SequelizeによるNULL制約変更の省略を避ける。
    await queryInterface.changeColumn(
        table,
        column,
        {
            type: Sequelize.INTEGER,
            allowNull: reverting ? wasNullable : true,
        },
        { transaction },
    );
    await queryInterface.addConstraint(table, {
        fields: [column],
        type: "foreign key",
        name: `${table}_${column}_fkey`,
        references: { table: target, field: "id" },
        onUpdate,
        onDelete: reverting ? "NO ACTION" : "SET NULL",
        transaction,
    });
}

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const relation of relations) {
                await changeRelation(queryInterface, Sequelize, relation, false, transaction);
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // seller_id/deleted_byにNULLがある場合は、データを変更せず全体をロールバックする。
            for (const relation of [...relations].reverse()) {
                await changeRelation(queryInterface, Sequelize, relation, true, transaction);
            }
        });
    },
};
