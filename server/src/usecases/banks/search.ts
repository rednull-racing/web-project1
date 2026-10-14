import { Banks } from "../../models/index.js";
import { getBanksAll } from "../../services/banks.js";

type Params = {
    kw: string;
};

// GET /banks/search?keyword=""
// summary: 銀行検索
// page: /edit/accountなど
export const searchBanksUseCase = async ({ kw }: Params) => {
    // 銀行全件取得
    const banks = await getBanksAll();

    // 検索
    const matchedBanks = banks
        .filter((bank: InstanceType<typeof Banks>) => {
            const name = (bank.name || "").toLowerCase();
            const kana = (bank.kana || "").toLowerCase();
            const hira = (bank.hira || "").toLowerCase();
            const nName = (bank.normalize?.name || "").toLowerCase();
            const nKana = (bank.normalize?.kana || "").toLowerCase();
            const nHira = (bank.normalize?.hira || "").toLowerCase();

            return (
                name.includes(kw) ||
                kana.includes(kw) ||
                hira.includes(kw) ||
                nName.includes(kw) ||
                nKana.includes(kw) ||
                nHira.includes(kw)
            );
        })
        .map((bank: InstanceType<typeof Banks>) => ({
            code: bank.code,
            name: bank.normalize?.name || bank.name,
            kana: bank.kana,
            hira: bank.hira,
        }));

    return matchedBanks;
};
