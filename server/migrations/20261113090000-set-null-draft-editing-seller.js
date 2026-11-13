const tables = ["item_draft", "item_editing"];

async function changeSellerReference(queryInterface, table, onDelete, transaction) {
    const foreignKeys = await queryInterface.getForeignKeyReferencesForTable(table, { transaction });
    for (const foreignKey of foreignKeys) {
        if (foreignKey.columnName === "seller_id") {
            await queryInterface.removeConstraint(table, foreignKey.constraintName, { transaction });
        }
    }
    await queryInterface.addConstraint(table, {
        fields: ["seller_id"],
        type: "foreign key",
        name: `${table}_seller_id_fkey`,
        references: { table: "user", field: "id" },
        onUpdate: "NO ACTION",
        onDelete,
        transaction,
    });
}

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const table of tables) {
                await changeSellerReference(queryInterface, table, "SET NULL", transaction);
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const table of [...tables].reverse()) {
                await changeSellerReference(queryInterface, table, "NO ACTION", transaction);
            }
        });
    },
};
