"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await queryInterface.addColumn(
                "item_editing",
                "status",
                {
                    type: Sequelize.ENUM("normal", "edit"),
                    allowNull: false,
                    defaultValue: "normal",
                },
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query("SET LOCAL lock_timeout = '5s'", { transaction });
            await queryInterface.removeColumn("item_editing", "status", { transaction });
            await queryInterface.sequelize.query('DROP TYPE "enum_item_editing_status"', { transaction });
        });
    },
};
