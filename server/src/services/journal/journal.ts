import { Transaction } from "sequelize";
import { Journal } from "../../models/index.js";

type CreateJournalParams = {
    data: {
        kanjyo_kari1: number;
        kanjyo_kari2?: number;
        kanjyo_kashi1: number;
        kanjyo_kashi2?: number;
        reason_id: number;
        price_kari1: number;
        price_kari2?: number;
        price_kashi1: number;
        price_kashi2?: number;
    };
    transaction?: Transaction;
};

export const createJournal = async ({ data, transaction }: CreateJournalParams) => {
    await Journal.create(data, { transaction });
};
