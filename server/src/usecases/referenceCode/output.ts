import { createOutputCode } from "../../services/referenceCode/referenceCode.js";
import { generateRandomReferenceCode } from "../../utils/generateReferenceCode.js";

type Params = {
    userId: number;
};

// POST /reference-code/output
// summary: 紹介コード生成
// page: /my-page
export const outputReferenceCodeUseCase = async ({ userId }: Params) => {
    // 紹介コード生成
    const output = generateRandomReferenceCode();

    // db作成
    await createOutputCode({
        data: {
            output,
            output_user_id: userId,
        },
    });

    return output;
};
