import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createAddressAllowNull } from "../../../services/address/address.js";
import { createBankAccountAllowNull } from "../../../services/bankAccount/bankAccount.js";
import { createNameShopAllowNull } from "../../../services/name/name.js";
import { getMyShopHasAddressNameBank } from "../../../services/shopInfo/query.js";
import { createShopEditComFree } from "../../../services/shopInfoEdit/command.js";

type Params = {
    shopId: number;
    userId: number;
    comFreeId: number;
};

// POST /shop-info-edit/:id/com-free
// summary: 事業形態変更リクエスト
// page: /edit/shop/com-free/[id]
export const createShopEditComFreeUseCase = async ({ shopId, userId, comFreeId }: Params) => {
    // shopInfo取得
    const shop = await getMyShopHasAddressNameBank({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);
    if (comFreeId === Number(shop.com_or_free_id)) {
        throw new AppError("INVALID_COM_FREE_ID", 400);
    }

    const address = shop.Address;
    const repName = shop.RepresentativeName;
    const conName = shop.ContactName;
    const bank = shop.BankAccount;

    // db作成
    const editId = await sequelize.transaction(async (t) => {
        const newRepName = await createNameShopAllowNull({
            data: {
                sei: repName?.sei ?? null,
                mei: repName?.mei ?? null,
                sei_kana: repName?.sei_kana ?? null,
                mei_kana: repName?.mei_kana ?? null,
                shop_type: "representative",
            },
            transaction: t,
        });

        const newConName = await createNameShopAllowNull({
            data: {
                sei: conName?.sei ?? null,
                mei: conName?.mei ?? null,
                sei_kana: conName?.sei_kana ?? null,
                mei_kana: conName?.mei_kana ?? null,
                shop_type: "contact",
            },
            transaction: t,
        });

        const newAddress = await createAddressAllowNull({
            data: {
                post_number: address?.post_number ?? null,
                todouhuken_id: address?.todouhuken_id ?? null,
                shikutyouson: address?.shikutyouson ?? null,
                banchi: address?.banchi ?? null,
                building: address?.building ?? null,
            },
            transaction: t,
        });

        const newAccount = await createBankAccountAllowNull({
            data: {
                bank_name: bank?.bank_name ?? null,
                bank_code: bank?.bank_code ?? null,
                branch: bank?.branch ?? null,
                branch_code: bank?.branch_code ?? null,
                account_type: bank?.account_type ?? "ordinary",
                account_number: bank?.account_number ?? null,
                meigi: bank?.meigi ?? null,
            },
            transaction: t,
        });

        const shopEdit = await createShopEditComFree({
            data: {
                company_name: shop.company_name,
                phone_number: shop.phone_number,
                email: shop.email,
                open_date_time: shop.open_date_time,
                founded_date: shop.founded_date,
                member_count: shop.member_count,
                homepage_url: shop.homepage_url,
                company_number: shop.company_number,
                capital: shop.capital,
                user_id: userId,
                shop_info_id: shopId,
                com_or_free_id: comFreeId,
                name_representative_id: newRepName.id,
                name_contact_id: newConName.id,
                address_id: newAddress.id,
                account_id: newAccount.id,
            },
            transaction: t,
        });

        return shopEdit.id;
    });

    return editId;
};
