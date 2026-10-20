"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn("item", "deleted_at", { transaction });
            await queryInterface.removeColumn("item_editing", "item_id", { transaction });
            await queryInterface.removeColumn("item_draft", "item_id", { transaction });
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // カラム定義のみ復元し、削除された値は復元しない。
            await queryInterface.addColumn(
                "item_draft",
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
            await queryInterface.addColumn(
                "item",
                "deleted_at",
                {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                { transaction },
            );
        });
    },
};
