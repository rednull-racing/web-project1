"use client";

import { ConfirmSection } from "@/components";
import styles from "@/components/confirm-card/confirmcard.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { getAccountTypeLabel } from "../../../lib/getAccountTypeLabel";
import { sleep } from "../../../lib/sleep";
import { fetchStep5, fetchUpdateField } from "../api/step5";
import { ButtonDiv } from "../buttonDiv";
import SSUI from "../ssUI";
import { ShopSignup } from "../type";

type Props = {
    shopSignupId: string;
    shopSignup: ShopSignup;
};

export const Client = ({ shopSignupId, shopSignup }: Props) => {
    const [comOrFree, setComOrFree] = useState(shopSignup.ComOrFreeOption?.id ?? "");
    const [companyName, setCompanyName] = useState(shopSignup.company_name ?? "");
    const [shopName, setShopName] = useState(shopSignup.shop_name ?? "");
    const [phoneNumber, setPhoneNumber] = useState(shopSignup.phone_number ?? "");
    const [email, setEmail] = useState(shopSignup.email ?? "");
    const [openDateTime, setOpenDateTime] = useState(shopSignup.open_date_time ?? "");
    const [foundedDate, setFoundedDate] = useState(shopSignup.founded_date ?? "");
    const [memberCount, setMemberCount] = useState(shopSignup.member_count ?? "");
    const [homepage, setHomepage] = useState(shopSignup.homepage_url ?? "");

    const [companyNumber, setCompanyNumber] = useState(shopSignup.company_number ?? "");
    const [capital, setCapital] = useState(shopSignup.capital);

    const [autoTrans, setAutoTrans] = useState(shopSignup.auto_trans ? "true" : "false");
    const [openInfo, setOpenInfo] = useState(shopSignup.open_info ? "true" : "false");

    const router = useRouter();

    const updateField = async (field: string, value: string | number | Date) => {
        try {
            await fetchUpdateField(shopSignupId, field, value);
        } catch (err) {
            if (err instanceof ApiError) return;

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const submit = async () => {
        try {
            await fetchStep5(shopSignupId);

            toast.success("ショップデータの登録が完了しました");
            await sleep(1500);

            router.replace("/shop-signup/complete");
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("データ登録に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const backSubmit = () => router.push(`/shop-signup/step4/${shopSignupId}`);

    const comNameTitle = comOrFree === 1 ? "会社名" : "屋号";

    const foundDateTitle = comOrFree === 1 ? "登記年月日" : "創業日";

    const displayFoundedDate = new Date(foundedDate).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <SSUI title="確認">
            <main className={styles.confirmWrapper}>
                <ConfirmSection
                    title="事業形態"
                    content={comOrFree === 1 ? "法人" : comOrFree === 2 ? "個人事業主" : ""}
                    radio
                    value={comOrFree}
                    radioOptions={[
                        { label: "法人", value: 1 },
                        { label: "個人事業主", value: 2 },
                    ]}
                    onChange={(v) => setComOrFree(Number(v))}
                    onSubmit={() => updateField("com_or_free_id", comOrFree)}
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
                    title="ショップ名"
                    content={shopName}
                    input
                    value={shopName}
                    onChange={(v) => setShopName(v)}
                    onSubmit={() => updateField("shop_name", shopName)}
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
                            onSubmit={() => updateField("capital", capital ?? 0)}
                        />
                    </>
                )}

                <ConfirmSection
                    title="代表者氏名"
                    content={`${shopSignup.RepresentativeName?.sei ?? ""} ${shopSignup.RepresentativeName?.mei ?? ""}`}
                    link={`/edit/name/shop/rep-name/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="代表者氏名（カナ）"
                    content={`${shopSignup.RepresentativeName?.sei_kana ?? ""} ${shopSignup.RepresentativeName?.mei_kana ?? ""}`}
                    link={`/edit/name/shop/rep-name/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="担当者氏名"
                    content={`${shopSignup.ContactName?.sei ?? ""} ${shopSignup.ContactName?.mei ?? ""}`}
                    link={`/edit/name/shop/con-name/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="担当者氏名（カナ）"
                    content={`${shopSignup.ContactName?.sei_kana ?? ""} ${shopSignup.ContactName?.mei_kana ?? ""}`}
                    link={`/edit/name/shop/con-name/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="所在地"
                    content={`〒${shopSignup.Address?.post_number ?? ""}
                ${shopSignup.Address?.AddressTodouhuken?.name ?? ""}
                ${shopSignup.Address?.shikutyouson ?? ""}
                ${shopSignup.Address?.banchi ?? ""}
                ${shopSignup.Address?.building ?? ""}`}
                    link={`/edit/address/shop/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="振込口座"
                    content={`銀行名： ${shopSignup.BankAccount?.bank_name ?? ""}
                支店名： ${shopSignup.BankAccount?.branch_code ?? ""}
                口座種別： ${getAccountTypeLabel({ accountType: shopSignup.BankAccount?.account_type ?? null })}
                口座番号： ${shopSignup.BankAccount?.account_number ?? ""}
                口座名義： ${shopSignup.BankAccount?.meigi ?? ""}`}
                    link={`/edit/account/shop/signup/${shopSignupId}`}
                />

                <ConfirmSection
                    title="自動振込"
                    content={autoTrans === "true" ? "はい" : "いいえ"}
                    radio
                    value={autoTrans}
                    radioOptions={[
                        { label: "はい", value: "true" },
                        { label: "いいえ", value: "false" },
                    ]}
                    onChange={(v) => setAutoTrans(v)}
                    onSubmit={() => updateField("auto_trans", autoTrans)}
                />

                <ConfirmSection
                    title="運営者情報を表示する"
                    content={openInfo === "true" ? "はい" : "いいえ"}
                    radio
                    value={openInfo}
                    radioOptions={[
                        { label: "はい", value: "true" },
                        { label: "いいえ", value: "false" },
                    ]}
                    onChange={(v) => setOpenInfo(v)}
                    onSubmit={() => updateField("open_info", openInfo)}
                />
            </main>

            <ButtonDiv backClick={backSubmit} nextClick={submit} />
        </SSUI>
    );
};
