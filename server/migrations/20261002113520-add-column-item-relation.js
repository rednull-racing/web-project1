"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                "item",
                "video_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "video",
                        key: "id",
                    },
                    onUpdate: "NO ACTION",
                    onDelete: "SET NULL",
                },
                { transaction },
            );

            await queryInterface.addColumn(
                "item",
                "sale_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "sale",
                        key: "id",
                    },
                    onUpdate: "NO ACTION",
                    onDelete: "SET NULL",
                },
                { transaction },
            );

            await queryInterface.addColumn(
                "item",
                "shipping_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "item_shipping_profile",
                        key: "id",
                    },
                    onUpdate: "NO ACTION",
                    onDelete: "SET NULL",
                },
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn("item", "shipping_id", { transaction });
            await queryInterface.removeColumn("item", "sale_id", { transaction });
            await queryInterface.removeColumn("item", "video_id", { transaction });
        });
    },
};
