import { createInquiry } from "../../services/inquiry/inquiry.js";

type Params = {
    userId: number | null;
    name: string;
    email: string;
    title: string;
    body: string;
};

// POST /inquiry
// summary: お問い合わせ作成
// page: /inquiry
export const createInquiryUseCase = async ({ userId, name, email, title, body }: Params) => {
    // お知らせ作成
    await createInquiry({
        data: {
            user_id: userId ?? null,
            name,
            email,
            title,
            body,
        },
    });

    // メール送信処理
};
