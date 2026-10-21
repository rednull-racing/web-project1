import { AppError } from "../../errors.js";
import { getMyAddress, updateAddress } from "../../services/address/address.js";
import { fetchAddressFromZipUseCase } from "./zipUseCase.js";

type Params = {
    userId: number;
    addressId: number;
    postNumber: string;
    todouhuken: string;
    shikutyouson: string;
    banchi: string;
    building?: string;
};

// PATCH /address/:id
// summary: 住所変更
// page: /edit/addressなど
export const editAddressUseCase = async ({
    userId,
    addressId,
    postNumber,
    todouhuken,
    shikutyouson,
    banchi,
    building,
}: Params) => {
    // Address取得
    const address = await getMyAddress({ addressId, userId });

    if (!address) throw new AppError("ADDRESS_NOT_FOUND", 404);

    // 住所バリデーションチェック
    const fromZip = await fetchAddressFromZipUseCase({ zipcode: postNumber });

    if (!fromZip) throw new AppError("INVALID_POSTNUMBER", 400);
    if (fromZip.todouhuken_name !== todouhuken) {
        throw new AppError("NOT_SAME_POSTNUMBER_TODOUHUKEN", 400);
    }
    if (fromZip.shikutyouson !== shikutyouson) {
        throw new AppError("NOT_SAME_POSTNUMBER_SHIKUTYOUSON", 400);
    }

    // db更新
    await updateAddress({
        address,
        data: {
            post_number: postNumber,
            todouhuken_id: fromZip.todouhuken_id,
            shikutyouson: shikutyouson,
            banchi: banchi,
            building: building,
        },
    });
};
