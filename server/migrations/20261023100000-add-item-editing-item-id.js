"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await queryInterface.addColumn(
                "item_editing",
                "item_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: "item", key: "id" },
                    onUpdate: "NO ACTION",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await queryInterface.removeColumn("item_editing", "item_id", { transaction });
        });
    },
};
