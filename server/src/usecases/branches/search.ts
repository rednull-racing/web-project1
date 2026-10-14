import { Branches } from "../../models/index.js";
import { getBranchesAll } from "../../services/branches.js";

type Params = {
    kw: string;
    bankCode: string;
};

// GET /branches/search?keyword=""&bankcode=""
// summary: 支店名検索
// page: /edit/accountなど
export const searchBranchesUseCase = async ({ kw, bankCode }: Params) => {
    // 支店名全件取得
    const branches = await getBranchesAll({ bankCode });

    // 検索
    const matchedBranches = branches
        .filter((b: InstanceType<typeof Branches>) => {
            const name = (b.name || "").toLowerCase();
            const kana = (b.kana || "").toLowerCase();
            const hira = (b.hira || "").toLowerCase();
            const nName = (b.normalize?.name || "").toLowerCase();
            const nKana = (b.normalize?.kana || "").toLowerCase();
            const nHira = (b.normalize?.hira || "").toLowerCase();

            return (
                name.includes(kw) ||
                kana.includes(kw) ||
                hira.includes(kw) ||
                nName.includes(kw) ||
                nKana.includes(kw) ||
                nHira.includes(kw)
            );
        })
        .map((b: InstanceType<typeof Branches>) => ({
            code: b.code,
            name: b.normalize?.name || b.name,
            kana: b.kana,
            hira: b.hira,
        }));

    return matchedBranches;
};
