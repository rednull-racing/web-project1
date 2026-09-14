"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.dropTable("permit", { cascade: true });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.createTable("permit", {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            permit_number: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            permit_type: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            issued_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            expired_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });
    },
};
