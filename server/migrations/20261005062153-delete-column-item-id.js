"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn("item_shipping_profile", "item_id", { transaction });
            await queryInterface.removeColumn("sale", "item_id", { transaction });
            await queryInterface.removeColumn("video", "item_id", { transaction });
            await queryInterface.removeColumn("video", "user_id", { transaction });
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                "video",
                "user_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: "user", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "video",
                "item_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    unique: true,
                    references: { model: "item", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "sale",
                "item_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    unique: true,
                    references: { model: "item", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
            // 削除済みの値は復元できないため、既存行がある場合は NOT NULL 制約により失敗する。
            await queryInterface.addColumn(
                "item_shipping_profile",
                "item_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    unique: true,
                    references: { model: "item", key: "id" },
                    onUpdate: "NO ACTION",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
        });
    },
};
