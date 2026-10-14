import { Banks, Branches } from "../models/index.js";
import sequelize from "../db.js";
import type { Transaction } from "sequelize";
import { z } from "zod";
import { AppError } from "../errors.js";
import type { BankNormalization } from "../types/bankNormalization.js";

const normalizationSchema: z.ZodType<BankNormalization> = z.object({
    name: z.string(),
    kana: z.string().optional(),
    hira: z.string().optional(),
    roma: z.string().optional(),
});

const directoryEntriesSchema = z.array(
    z.object({
        code: z.string(),
        name: z.string(),
        kana: z.string().nullable(),
        hira: z.string().nullable(),
        normalize: normalizationSchema.nullable(),
    }),
);

type DirectoryEntry = z.infer<typeof directoryEntriesSchema>[number];

const parseDirectoryEntries = (data: unknown): DirectoryEntry[] => {
    const result = directoryEntriesSchema.safeParse(data);
    if (!result.success) {
        throw new AppError("INVALID_BANK_DIRECTORY_DATA", 500);
    }
    return result.data;
};

(async () => {
    let t: Transaction | undefined;
    try {
        await sequelize.authenticate();
        console.log("DB接続成功！");

        t = await sequelize.transaction();

        let allBanks: DirectoryEntry[] = [];
        let page = 1;

        while (true) {
            const res = await fetch(`https://bank.teraren.com/banks.json?page=${page}`);
            const data: unknown = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            allBanks = allBanks.concat(parseDirectoryEntries(data));
            page++;
        }

        console.log(`銀行データ${allBanks.length}件取得完了！`);

        await Banks.bulkCreate(
            allBanks.map((bank) => ({
                code: bank.code,
                name: bank.name,
                kana: bank.kana,
                hira: bank.hira,
                normalize: bank.normalize,
            })),
            {
                updateOnDuplicate: ["name", "kana", "hira", "normalize"],
                transaction: t,
            },
        );

        console.log("銀行データ登録完了！");

        for (const bank of allBanks) {
            let allBranches: DirectoryEntry[] = [];
            let branchPage = 1;

            while (true) {
                const res = await fetch(`https://bank.teraren.com/banks/${bank.code}/branches.json?page=${branchPage}`);
                const branchData: unknown = await res.json();
                if (!Array.isArray(branchData) || branchData.length === 0) break;
                allBranches = allBranches.concat(parseDirectoryEntries(branchData));
                branchPage++;
            }

            if (allBranches.length > 0) {
                await Branches.bulkCreate(
                    allBranches.map((branch) => ({
                        bank_code: bank.code,
                        code: branch.code,
                        name: branch.name,
                        kana: branch.kana,
                        hira: branch.hira,
                        normalize: branch.normalize,
                    })),
                    {
                        updateOnDuplicate: ["name", "kana", "hira", "normalize"],
                        transaction: t,
                    },
                );
            }

            console.log(`${bank.name}の支店${allBranches.length}件登録完了`);
        }
        await t.commit();

        console.log("全銀行、支店データ登録完了");
        process.exit(0);
    } catch (err) {
        if (t) await t.rollback();
        console.error("銀行データ登録エラー：", err);
        process.exit(1);
    }
})();
