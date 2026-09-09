"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                "permit_file",
                "permit_number",
                {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "permit_type",
                {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "issued_at",
                {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "expired_at",
                {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "shop_info_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "shop_info",
                        key: "id",
                    },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "shop_info_edit_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "shop_info_edit",
                        key: "id",
                    },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );
            await queryInterface.addColumn(
                "permit_file",
                "shop_signup_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "shop_signup",
                        key: "id",
                    },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );

            await queryInterface.removeColumn("permit_file", "permit_id", { transaction });
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn(
                "permit_file",
                "permit_id",
                {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: "permit",
                        key: "id",
                    },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                { transaction },
            );

            for (const columnName of [
                "shop_signup_id",
                "shop_info_edit_id",
                "shop_info_id",
                "expired_at",
                "issued_at",
                "permit_type",
                "permit_number",
            ]) {
                await queryInterface.removeColumn("permit_file", columnName, { transaction });
            }
        });
    },
};
