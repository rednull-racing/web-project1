import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createAddress } from "../../../services/address.js";
import { createNameShop } from "../../../services/name.js";
import { createShopSignup } from "../../../services/shopSignup.js";
import { fetchAddressFromZipUseCase } from "../../address/zipUseCase.js";
import { Signup1Body } from "./body.js";

type Params = {
    userId: number;
    body: Signup1Body;
};

// POST /shop-signup
// summary: ShopSignup作成 事業者登録
// page: /shop-signup/step1
export const createShopSignup1 = async ({ userId, body }: Params) => {
    const {
        selectOption,
        companyName,
        shopName,
        phoneNumber,
        email,
        openDateTime,
        foundedDate,
        memberCount,
        homepage,
        repSei,
        repMei,
        repSeiKana,
        repMeiKana,
        conSei,
        conMei,
        conSeiKana,
        conMeiKana,
        postNumber,
        todouhuken,
        shikutyouson,
        banchi,
        building,
        companyNumber,
        capital,
    } = body;

    // 空チェック
    if (selectOption === 1 && (!companyNumber || !capital)) {
        throw new AppError("INVALID_BODY", 400);
    }

    // トリム
    const trimFields = {
        phoneNumber,
        email,
        openDateTime,
        repSei,
        repMei,
        repSeiKana,
        repMeiKana,
        conSei,
        conMei,
        conSeiKana,
        conMeiKana,
        postNumber,
        todouhuken,
        shikutyouson,
        banchi,
    };

    const trimmed = Object.fromEntries(Object.entries(trimFields).map(([key, value]) => [key, value?.trim() ?? value]));

    // 住所バリデーションチェック
    const fromZip = await fetchAddressFromZipUseCase({ zipcode: trimmed.postNumber });

    if (!fromZip) throw new AppError("INVALID_POSTNUMBER", 400);
    if (fromZip.todouhuken_name !== trimmed.todouhuken) {
        throw new AppError("NOT_SAME_POSTNUMBER_TODOUHUKEN", 400);
    }
    if (fromZip.shikutyouson !== trimmed.shikutyouson) {
        throw new AppError("NOT_SAME_POSTNUMBER_SHIKUTYOUSON", 400);
    }

    // db作成
    const shopSignupId = await sequelize.transaction(async (t) => {
        // 代表者氏名
        const repName = await createNameShop({
            data: {
                sei: trimmed.repSei,
                mei: trimmed.repMei,
                sei_kana: trimmed.repSeiKana,
                mei_kana: trimmed.repMeiKana,
                shop_type: "representative",
            },
            transaction: t,
        });

        // 担当者氏名
        const conName = await createNameShop({
            data: {
                sei: trimmed.conSei,
                mei: trimmed.conMei,
                sei_kana: trimmed.conSeiKana,
                mei_kana: trimmed.conMeiKana,
                shop_type: "contact",
            },
            transaction: t,
        });

        // 住所
        const newAddress = await createAddress({
            data: {
                post_number: trimmed.postNumber,
                todouhuken_id: fromZip.todouhuken_id,
                shikutyouson: trimmed.shikutyouson,
                banchi: trimmed.banchi,
                building,
            },
            transaction: t,
        });

        const newAddressId = newAddress.id;

        // shopSignup作成
        const shopSignup = await createShopSignup({
            data: {
                company_name: companyName,
                shop_name: shopName,
                phone_number: trimmed.phoneNumber,
                email: trimmed.email,
                homepage_url: homepage ?? null,
                open_date_time: trimmed.openDateTime,
                company_number: companyNumber ?? null,
                capital: capital ?? 0,
                member_count: memberCount,
                user_id: userId,
                address_id: newAddressId,
                com_or_free_id: selectOption ?? 2,
                founded_date: foundedDate,
                name_representative_id: repName.id,
                name_contact_id: conName.id,
            },
            transaction: t,
        });

        return shopSignup.id;
    });

    return shopSignupId;
};
