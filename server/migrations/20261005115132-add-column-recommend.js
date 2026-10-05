"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                "item_draft",
                "recommend",
                {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                    defaultValue: false,
                },
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn("item_draft", "recommend", { transaction });
        });
    },
};
