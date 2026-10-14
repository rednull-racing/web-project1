import { AppError } from "../../../errors.js";
import { publicS3Domain } from "../../../infra/aws/s3.js";
import { updateShopName } from "../../../services/shopInfo/command.js";
import { updateProfileUser } from "../../../services/users/command.js";
import { getUserHasShop } from "../../../services/users/query.js";
import { deleteCmdS3 } from "../../../utils/s3/deleteCmd.js";
import { generateSignedUrl } from "../../../utils/s3/signedUrl.js";
import { ProfileEditBody } from "../../../validators/body/users.js";

type Params = {
    userId: number;
    body: ProfileEditBody;
    imageEdit: boolean;
};

// PATCH /user/profile?imageEdit=boolean
// summary: プロフィール編集
// page: /edit/profile
export const editProfileUseCase = async ({ userId, body, imageEdit }: Params) => {
    const now = Date.now();

    const { userName, introduction, fileName, contentType } = body;

    // user取得
    const user = await getUserHasShop({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // プロフィール画像署名付きurl取得
    let signedUrl: string | null = null;
    let imageUrl: string | null = null;
    const oldImageUrl = user.profile_image;

    if (fileName && contentType && imageEdit) {
        const key = `profile-image/${userId}/${now}_${fileName}`;

        signedUrl = await generateSignedUrl({ key, contentType });

        imageUrl = `${publicS3Domain}/${key}`;
    }

    // DB更新
    const updateData: {
        user_name: string;
        user_introduction: string | null;
        profile_image: string | null;
    } = {
        user_name: userName,
        user_introduction: introduction ?? null,
        profile_image: null,
    };

    if (imageEdit) {
        updateData.profile_image = imageUrl;
    }

    await updateProfileUser({
        user,
        data: updateData,
    });

    // ショップ判定・ショップDB更新
    if (user.ShopInfo) {
        await updateShopName({
            shopInfo: user.ShopInfo,
            data: { shop_name: userName },
        });
    }

    // 旧プロフィール画像URL削除
    if ((!fileName && imageEdit && oldImageUrl) || (imageUrl && oldImageUrl && imageUrl !== oldImageUrl)) {
        const oldKey = oldImageUrl.split(".com/")[1];

        deleteCmdS3({ key: oldKey }).catch((err) => {
            console.error("s3 deleteCmdS3 error:", err);
        });
    }

    return signedUrl;
};
