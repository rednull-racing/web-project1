"use client";

import EditUI from "@/app/edit/editUI";
import { ShopInfo, ShopInfoEdit } from "@/app/edit/types";
import { ConfirmSection } from "@/components";
import styles from "@/components/confirm-card/confirmcard.module.css";
import { Button } from "@/components/inputForm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../../../../../lib/api/apiError";
import { getAccountTypeLabel } from "../../../../../lib/getAccountTypeLabel";
import { fetchUpdateField } from "../../../api/shop/shopEdit/client";

type Props = {
    shopId: string;
    shopInfo: ShopInfo;
    shopEditId: string;
    shopInfoEdit: ShopInfoEdit;
};

export const Client = ({ shopId, shopInfo, shopEditId, shopInfoEdit }: Props) => {
    const [companyName, setCompanyName] = useState(shopInfoEdit.company_name ?? shopInfo.company_name ?? "");
    const [phoneNumber, setPhoneNumber] = useState(shopInfoEdit.phone_number ?? shopInfo.phone_number ?? "");
    const [email, setEmail] = useState(shopInfoEdit.email ?? shopInfo.email ?? "");
    const [openDateTime, setOpenDateTime] = useState(shopInfoEdit.open_date_time ?? shopInfo.open_date_time ?? "");
    const [foundedDate, setFoundedDate] = useState(shopInfoEdit.founded_date ?? shopInfo.founded_date ?? "");
    const [memberCount, setMemberCount] = useState(shopInfoEdit.member_count ?? shopInfo.member_count ?? "");
    const [homepage, setHomepage] = useState(shopInfoEdit.homepage_url ?? shopInfo.homepage_url ?? "");

    const [companyNumber, setCompanyNumber] = useState(shopInfoEdit.company_number ?? shopInfo.company_number ?? "");
    const [capital, setCapital] = useState(shopInfoEdit.capital ?? shopInfo.capital ?? "");

    const router = useRouter();

    const updateField = async (field: string, value: string | number | Date) => {
        try {
            await fetchUpdateField(shopEditId, field, value);
        } catch (err) {
            if (err instanceof ApiError) return;

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const submit = async () => router.push(`/edit/shop/com-free/upload/${shopEditId}`);

    const comOrFree = shopInfoEdit.ComOrFreeOption?.id;

    const comNameTitle = comOrFree === 1 ? "会社名" : "屋号";

    const foundDateTitle = comOrFree === 1 ? "登記年月日" : "創業日";

    const displayFoundedDate = new Date(foundedDate).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const repName = shopInfoEdit.RepresentativeNameEdit ?? shopInfo.RepresentativeName;
    const conName = shopInfoEdit.ContactNameEdit ?? shopInfo.ContactName;
    const address = shopInfoEdit.Address ?? shopInfo.Address;
    const bankAccount = shopInfoEdit.BankAccount ?? shopInfo.BankAccount;

    return (
        <EditUI title="事業者情報の確認・変更">
            <main className={styles.confirmWrapper}>
                <ConfirmSection
                    title="事業形態"
                    content={comOrFree === 1 ? "法人" : comOrFree === 2 ? "個人事業主" : ""}
                    link={`/edit/shop/com-free/${shopId}`}
                />

                <ConfirmSection
                    title={comNameTitle}
                    content={companyName}
                    input
                    value={companyName}
                    onChange={(v) => setCompanyName(v)}
                    onSubmit={() => updateField("company_name", companyName)}
                />

                <ConfirmSection
                    title="電話番号"
                    content={phoneNumber}
                    input
                    value={phoneNumber}
                    onChange={(v) => setPhoneNumber(v)}
                    onSubmit={() => updateField("phone_number", phoneNumber)}
                />

                <ConfirmSection
                    title="代表メールアドレス"
                    content={email}
                    input
                    value={email}
                    onChange={(v) => setEmail(v)}
                    onSubmit={() => updateField("email", email)}
                />

                <ConfirmSection
                    title="営業日・定休日"
                    content={openDateTime}
                    input
                    value={openDateTime}
                    onChange={(v) => setOpenDateTime(v)}
                    onSubmit={() => updateField("open_date_time", openDateTime)}
                />

                <ConfirmSection
                    title={foundDateTitle}
                    content={displayFoundedDate}
                    date
                    value={foundedDate}
                    onChange={(v) => setFoundedDate(v)}
                    onSubmit={() => updateField("founded_date", foundedDate)}
                />

                <ConfirmSection
                    title="従業員数"
                    content={memberCount.toLocaleString()}
                    input
                    value={memberCount}
                    onChange={(v) => setMemberCount(v)}
                    onSubmit={() => updateField("member_count", memberCount)}
                />

                <ConfirmSection
                    title="ホームページURL"
                    content={homepage}
                    input
                    value={homepage}
                    onChange={(v) => setHomepage(v)}
                    onSubmit={() => updateField("homepage_url", homepage)}
                />

                {comOrFree === 1 && (
                    <>
                        <ConfirmSection
                            title="法人番号"
                            content={companyNumber}
                            input
                            value={companyNumber}
                            onChange={(v) => setCompanyNumber(v)}
                            onSubmit={() => updateField("company_number", companyNumber)}
                        />

                        <ConfirmSection
                            title="資本金"
                            content={`￥${capital?.toLocaleString() ?? ""}`}
                            input
                            value={capital}
                            onChange={(v) => setCapital(v)}
                            onSubmit={() => updateField("capital", capital)}
                        />
                    </>
                )}

                <ConfirmSection
                    title="代表者氏名"
                    content={`${repName?.sei ?? ""} ${repName?.mei ?? ""}`}
                    link={`/edit/name/shop/rep-name/com-free/${shopEditId}`}
                />

                <ConfirmSection
                    title="代表者氏名（カナ）"
                    content={`${repName?.sei_kana ?? ""} ${repName?.mei_kana ?? ""}`}
                    link={`/edit/name/shop/rep-name/com-free/${shopEditId}`}
                />

                <ConfirmSection
                    title="担当者氏名"
                    content={`${conName?.sei ?? ""} ${conName?.mei ?? ""}`}
                    link={`/edit/name/shop/con-name/com-free/${shopEditId}`}
                />

                <ConfirmSection
                    title="担当者氏名（カナ）"
                    content={`${conName?.sei_kana ?? ""} ${conName?.mei_kana ?? ""}`}
                    link={`/edit/name/shop/con-name/com-free/${shopEditId}`}
                />

                <ConfirmSection
                    title="所在地"
                    content={`〒${address?.post_number ?? ""}
                ${address?.AddressTodouhuken?.name ?? ""}
                ${address?.shikutyouson ?? ""}
                ${address?.banchi ?? ""}
                ${address?.building ?? ""}`}
                    link={`/edit/address/shop/com-free/${shopEditId}`}
                />

                <ConfirmSection
                    title="振込口座"
                    content={`銀行名： ${bankAccount?.bank_name ?? ""}
                支店名： ${bankAccount?.branch_code ?? ""}
                口座種別： ${getAccountTypeLabel({ accountType: bankAccount?.account_type ?? null })}
                口座番号： ${bankAccount?.account_number ?? ""}
                口座名義： ${bankAccount?.meigi ?? ""}`}
                    link={`/edit/account/shop/com-free/${shopEditId}`}
                />

                <Button onClick={submit}>次へ</Button>
            </main>
        </EditUI>
    );
};
