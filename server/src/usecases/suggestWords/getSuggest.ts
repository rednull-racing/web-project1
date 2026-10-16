import { SuggestWords } from "../../models/index.js";
import { getSuggestAll } from "../../services/suggestWords/suggestWords.js";

type Params = {
    keyword: string;
};

// GET /suggest-words?keyword
// summary: 検索サジェスト一覧取得
// page: header
export const getSuggestUseCase = async ({ keyword }: Params) => {
    // サジェストリスト取得
    const words = await getSuggestAll({ keyword });

    // サジェスト配列化
    const suggest = words.map((w: InstanceType<typeof SuggestWords>) => w.word);

    return suggest;
};
