"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addConstraint("permit", {
                fields: ["shop_info_id", "shop_info_edit_id", "shop_signup_id"],
                type: "unique",
                name: "permit_shop_reference_unique",
                transaction,
            });

            await queryInterface.sequelize.query(
                `ALTER TABLE permit
                 ADD CONSTRAINT chk_permit_has_single_shop_reference
                 CHECK (
                     num_nonnulls(shop_info_id, shop_info_edit_id, shop_signup_id) = 1
                 );`,
                { transaction },
            );
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeConstraint("permit", "chk_permit_has_single_shop_reference", {
                transaction,
            });
            await queryInterface.removeConstraint("permit", "permit_shop_reference_unique", {
                transaction,
            });
        });
    },
};
