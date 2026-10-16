import { AppError } from "../../errors.js";
import { AddressResult } from "../../infra/zipcloud/type.js";
import { fetchZipCloud } from "../../infra/zipcloud/zip.js";
import { getTodouhukenOne } from "../../services/todouhuken/todouhuken.js";

type Params = {
    zipcode: string;
};

// GET /address/search
// summary: 住所検索
// page: /edit/addressなど
export const fetchAddressFromZipUseCase = async ({ zipcode }: Params): Promise<AddressResult> => {
    // zipCloudフェッチ
    const data = await fetchZipCloud({ zipcode });

    if (data.results && data.results.length > 0) {
        const result = data.results[0];

        // 都道府県マスターバリデーションチェック
        const todouhuken = await getTodouhukenOne({ todouhuken: result.address1 });

        if (!todouhuken) throw new AppError("TODOUHUKEN_NOT_FOUND", 404);
        if (todouhuken.id < 1 || todouhuken.id > 47) {
            throw new AppError("INVALID_TODOUHUKEN", 400);
        }

        return {
            todouhuken_id: todouhuken.id,
            todouhuken_name: todouhuken.name,
            shikutyouson: result.address2,
            banchi: result.address3,
        };
    } else {
        throw new AppError("ADDRESS_NOT_FOUND", 404);
    }
};
