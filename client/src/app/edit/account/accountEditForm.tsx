/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button, InputStr, InputTitle } from "@/components/inputForm/index";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { SITE } from "../../../config/site";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchAccountEdit, fetchShopAccountEdit, fetchSuggestBanks, fetchSuggestBranches } from "../api/account/client";
import styles from "../edit.module.css";
import EditUI from "../editUI";
import { BankAccount } from "../type";
import { showBankErrorToast } from "./bankErrorMessage";

type Props = {
    account: BankAccount;
    page: "normal" | "transfer" | "shop" | "shop-signup" | "com-free";
    shopId?: string;
    shopEditId?: string;
};

export const AccountEditForm = ({ account, page, shopId, shopEditId }: Props) => {
    const [bankQuery, setBankQuery] = useState(account?.bank_name ?? "");
    const [bankSuggestions, setBankSuggestions] = useState<
        {
            name: string;
            code: string;
            hira: string;
            kana: string;
        }[]
    >([]);
    const [showBankSuggest, setShowBankSuggest] = useState(false);
    const [isSelectingBank, setIsSelectingBank] = useState(false);

    const [bankCode, setBankCode] = useState(account?.bank_code ?? "");

    const [branchQuery, setBranchQuery] = useState(account?.branch ?? "");
    const [branchSuggestions, setBranchSuggestions] = useState<
        {
            name: string;
            code: string;
            hira: string;
            kana: string;
        }[]
    >([]);
    const [showBranchSuggest, setShowBranchSuggest] = useState(false);
    const [isSelectingBranch, setIsSelectingBranch] = useState(false);

    const [branchCode, setBranchCode] = useState(account?.branch_code ?? "");

    const [accountType, setAccountType] = useState(account?.account_type ?? "");
    const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
    const [meigi, setMeigi] = useState(account?.meigi ?? "");

    const router = useRouter();

    const suggestTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isSelectingBank) return;
        if (!bankQuery || bankQuery === account.bank_name) {
            setBankSuggestions([]);
            setShowBankSuggest(false);
            return;
        }

        if (suggestTimeout.current) clearTimeout(suggestTimeout.current);

        suggestTimeout.current = setTimeout(async () => {
            try {
                const data = await fetchSuggestBanks(bankQuery);

                const suggestions =
                    data?.banks?.map((b: any) => ({
                        name: b.name,
                        code: b.code,
                        kana: b.kana,
                        hira: b.hira,
                        normalize: b.normalize,
                    })) || [];

                setBankSuggestions(suggestions);
                setShowBankSuggest(suggestions.length > 0);
            } catch {
                setBankSuggestions([]);
                setShowBankSuggest(false);
            }
        }, 300);

        return () => {
            if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
        };
    }, [bankQuery, account.bank_name, isSelectingBank]);

    useEffect(() => {
        if (isSelectingBranch) return;
        if (!branchQuery || branchQuery === account.branch) {
            setBranchSuggestions([]);
            setShowBranchSuggest(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            try {
                const queryBankCode = bankCode || account.bank_code;

                const data = await fetchSuggestBranches(branchQuery, queryBankCode);

                const suggestions =
                    data?.branches?.map((b: any) => ({
                        name: b.name,
                        code: b.code,
                        kana: b.kana,
                        hira: b.hira,
                    })) || [];

                setBranchSuggestions(suggestions);
                setShowBranchSuggest(suggestions.length > 0);
            } catch {
                setBranchSuggestions([]);
                setShowBranchSuggest(false);
            }
        }, 300);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [branchQuery, bankCode, account, isSelectingBranch]);

    const submit = async () => {
        const bankTrim = bankQuery.trim();
        const branchTrim = branchQuery.trim();
        const accountNumberTrim = accountNumber.trim();

        if (!bankTrim || !branchTrim || !accountType || !accountNumberTrim || !meigi.trim()) {
            toast.error("空の項目があります");
            return;
        }

        if (!/^[0-9]{5,7}$/.test(accountNumberTrim)) {
            toast.error("口座番号は5〜7桁の半角数字で入力してください");
            return;
        }

        const body = {
            bankName: bankTrim,
            bankCode: bankCode.trim(),
            branch: branchTrim,
            branchCode: branchCode.trim(),
            accountType: accountType,
            accountNumber: accountNumberTrim.padStart(7, "0"),
            meigi: meigi,
        };

        try {
            if (page === "shop") {
                if (!shopId) throw new Error();

                await fetchShopAccountEdit(shopId, body);

                toast.success("口座情報の変更を受け付けました。審査完了までしばらくお待ちください");
                await sleep(1500);

                router.push(`/shop-info/${shopId}`);
                return;
            }

            await fetchAccountEdit(account.id, body);

            toast.success("口座情報を登録しました");
            await sleep(1500);

            if (page === "normal") {
                router.push("/my-page");
            } else if (page === "transfer") {
                router.push("/transfer/request");
            } else if (page === "shop-signup") {
                router.push(`/shop-signup/step5/${shopId}`);
            } else if (page === "com-free") {
                router.push(`/edit/shop/com-free/confirm/${shopEditId}`);
            }
        } catch (err) {
            if (err instanceof ApiError) {
                showBankErrorToast(err.code);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <EditUI title="振込口座の設定">
            {page === "normal" && <p className={styles.small}>※振込申請の際にも口座を設定できます。</p>}

            <div className={styles.inputDiv}>
                <InputTitle title="銀行名" hissu />
                <input
                    type="text"
                    value={bankQuery}
                    onChange={(e) => setBankQuery(e.target.value)}
                    onFocus={() => {
                        setShowBankSuggest(true);
                        setShowBranchSuggest(false);
                    }}
                    onBlur={() => setTimeout(() => setShowBankSuggest(false), 150)}
                    placeholder={SITE.inputBankName}
                    className={styles.input}
                    required
                />
                {showBankSuggest && bankSuggestions.length > 0 && (
                    <ul className={styles.searchUl}>
                        {bankSuggestions.map((bank, i) => (
                            <li
                                key={i}
                                onMouseDown={() => {
                                    setIsSelectingBank(true);
                                    setBankQuery(bank.name);
                                    setBankCode(bank.code);
                                    setShowBankSuggest(false);
                                    account.bank_name = bank.name;

                                    setTimeout(() => setIsSelectingBank(false), 500);
                                }}
                                className={styles.searchLi}
                            >
                                {bank.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className={styles.inputDiv}>
                <InputTitle title="支店名" hissu />
                <input
                    type="text"
                    value={branchQuery}
                    onChange={(e) => setBranchQuery(e.target.value)}
                    onFocus={() => {
                        setShowBranchSuggest(true);
                        setShowBankSuggest(false);
                    }}
                    onBlur={() => setTimeout(() => setShowBranchSuggest(false), 150)}
                    placeholder={SITE.inputBranchName}
                    className={styles.input}
                    required
                />
                {showBranchSuggest && branchSuggestions.length > 0 && (
                    <ul className={styles.searchUl}>
                        {branchSuggestions.map((branch, i) => (
                            <li
                                key={i}
                                onMouseDown={() => {
                                    setIsSelectingBranch(true);
                                    setBranchQuery(branch.name);
                                    setBranchCode(branch.code);
                                    setShowBranchSuggest(false);
                                    account.branch = branch.name;

                                    setTimeout(() => setIsSelectingBranch(false), 500);
                                }}
                                className={styles.searchLi}
                            >
                                {branch.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className={styles.selectDiv}>
                <InputTitle title="口座種別" hissu />
                <select
                    aria-label="口座種別"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className={styles.select}
                >
                    <option value="" disabled className={styles.option}>
                        --1つ選択してください。--
                    </option>
                    <option value="ordinary" className={styles.option}>
                        普通預金
                    </option>
                    <option value="checking" className={styles.option}>
                        当座預金
                    </option>
                    <option value="savings" className={styles.option}>
                        貯蓄預金
                    </option>
                </select>
            </div>

            <InputStr
                title="口座番号"
                type="text"
                value={accountNumber}
                onChange={(v) => setAccountNumber(v.replace(/[^0-9]/g, ""))}
                placeholder={SITE.inputAccountNumber}
                hissu
                numeric
                patternNum
            />

            <InputStr
                title="口座名義"
                type="text"
                value={meigi}
                onChange={setMeigi}
                placeholder={SITE.inputName}
                hissu
            />

            {page === "shop" && (
                <p className={clsx(styles.centerSmall, "mt-4")}>
                    ※口座情報の変更は審査が必要になります。登録される口座情報の変更は審査が完了し次第となります。審査には1~2週間ほどお時間を頂戴しております。
                </p>
            )}

            <Button onClick={submit}>登録する</Button>
        </EditUI>
    );
};
