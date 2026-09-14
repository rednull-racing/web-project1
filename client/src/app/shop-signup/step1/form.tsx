"use client";

import { InputStr, InputStrAndSmall, InputTitle } from "@/components/inputForm";
import clsx from "clsx";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import toast from "react-hot-toast";
import { SITE } from "../../../config/site";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { showAddressErrorToast } from "../../edit/address/addressErrorMessage";
import { fetchGetAddress, fetchStep1 } from "../api/step1";
import { ButtonDiv } from "../buttonDiv";
import styles from "../ss.module.css";
import SSUIBack from "../ssUiBack";
import { StepBar } from "../stepBar";
import { ComOrFreeOption, ShopSignup, User } from "../type";

type Props = {
    user: User;
    shopSignup: ShopSignup | null;
    ComOrFreeOption: ComOrFreeOption[];
};

export const Form = ({ user, shopSignup, ComOrFreeOption }: Props) => {
    const [selectOption, setSelectOption] = useState<number | null>(null);
    const [companyName, setCompanyName] = useState(shopSignup?.company_name);
    const [shopName, setShopName] = useState(shopSignup?.shop_name ?? user.user_name ?? "");
    const [phoneNumber, setPhoneNumber] = useState(shopSignup?.phone_number ?? user.phone_number ?? "");
    const [email, setEmail] = useState(shopSignup?.email ?? user.email ?? "");
    const [openDateTime, setOpenDateTime] = useState(shopSignup?.open_date_time);
    const [foundedDate, setFoundedDate] = useState(shopSignup?.founded_date);
    const [memberCount, setMemberCount] = useState(shopSignup?.member_count ?? 0);
    const [homepage, setHomepage] = useState(shopSignup?.homepage_url);

    const [companyNumber, setCompanyNumber] = useState(shopSignup?.company_number);
    const [capital, setCapital] = useState(shopSignup?.capital);

    const [repSei, setRepSei] = useState(shopSignup?.RepresentativeName?.sei ?? user.Name?.sei);
    const [repMei, setRepMei] = useState(shopSignup?.RepresentativeName?.mei ?? user.Name?.mei);
    const [repSeiKana, setRepSeiKana] = useState(shopSignup?.RepresentativeName?.sei_kana ?? user.Name?.sei_kana);
    const [repMeiKana, setRepMeiKana] = useState(shopSignup?.RepresentativeName?.mei_kana ?? user.Name?.mei_kana);

    const [conSei, setConSei] = useState(shopSignup?.ContactName?.sei ?? user.Name?.sei);
    const [conMei, setConMei] = useState(shopSignup?.ContactName?.mei ?? user.Name?.mei);
    const [conSeiKana, setConSeiKana] = useState(shopSignup?.ContactName?.sei_kana ?? user.Name?.sei_kana);
    const [conMeiKana, setConMeiKana] = useState(shopSignup?.ContactName?.mei_kana ?? user.Name?.mei_kana);

    const [postNumber, setPostNumber] = useState(shopSignup?.Address?.post_number ?? user.Address?.post_number);
    const [todouhuken, setTodouhuken] = useState(
        shopSignup?.Address?.AddressTodouhuken?.name ?? user.Address?.AddressTodouhuken?.name,
    );
    const [shikutyouson, setShikutyouson] = useState(shopSignup?.Address?.shikutyouson ?? user.Address?.shikutyouson);
    const [banchi, setBanchi] = useState(shopSignup?.Address?.banchi ?? user.Address?.banchi);
    const [building, setBuilding] = useState(shopSignup?.Address?.building ?? user.Address?.building);

    const [check, setCheck] = useState(false);

    const router = useRouter();

    const handleZipSearch = async (postNumber: string) => {
        if (!postNumber || postNumber.length < 7) {
            toast.error("7桁の郵便番号を入力してください");
            return;
        }

        try {
            const address = await fetchGetAddress(postNumber);

            setTodouhuken(address.todouhuken_name);
            setShikutyouson(address.shikutyouson);
        } catch (err) {
            if (err instanceof ApiError) {
                showAddressErrorToast(err.code);
                return;
            }
        }
    };

    const handlePostNumberChange = (value: string) => {
        setPostNumber(value);

        if (value.length === 7) {
            void handleZipSearch(value);
        }
    };

    const submit = async () => {
        if (!check) {
            toast.error("利用規約およびプライバシーポリシーに同意の上、チェックボタンを押してください");
            return;
        }

        const normalizedPostNumber = postNumber?.replace(/-/g, "");
        if (!/^[0-9]{7}$/.test(normalizedPostNumber || "")) {
            toast.error("郵便番号は半角数字7桁で入力してください");
            return;
        }

        if (memberCount > 100000000 || memberCount === 0) {
            toast.error("従業員数が不正な値です");
            return;
        }

        if (companyNumber && (!/^\d+$/.test(companyNumber) || companyNumber.length !== 13) && selectOption === 1) {
            toast.error("法人番号が正しくありません");
            return;
        }

        const body = {
            selectOption,
            companyName,
            shopName,
            phoneNumber,
            email,
            openDateTime,
            foundedDate,
            memberCount,
            homepage,
            repSei,
            repMei,
            repSeiKana,
            repMeiKana,
            conSei,
            conMei,
            conSeiKana,
            conMeiKana,
            postNumber,
            todouhuken,
            shikutyouson,
            banchi,
            building,
            ...(selectOption === 1 && {
                companyNumber,
                capital,
            }),
        };

        const requiredBody = [
            selectOption,
            companyName,
            shopName,
            phoneNumber,
            email,
            openDateTime,
            foundedDate,
            memberCount,
            repSei,
            repMei,
            repSeiKana,
            repMeiKana,
            conSei,
            conMei,
            conSeiKana,
            conMeiKana,
            postNumber,
            todouhuken,
            shikutyouson,
            banchi,
            ...(selectOption === 1 ? [companyNumber, capital] : []),
        ];

        if (requiredBody.some((v) => v === "" || v === undefined || v === null)) {
            toast.error("未入力の項目があります");
            return;
        }

        try {
            const data = await fetchStep1(body);

            toast.success("ショップデータを登録しました");
            await sleep(1500);

            router.push(`/shop-signup/step2/${data.shopSignupId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("データ登録に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const backSubmit = () => router.back();

    return (
        <SSUIBack title="ショップ登録">
            <StepBar />

            <h2 className={styles.subtitle}>事業者情報</h2>

            <div className={styles.radioFlex}>
                <p className={styles.text14}>事業形態を選択：</p>
                <div className={styles.radioColumn}>
                    {ComOrFreeOption.map((option) => (
                        <label key={option.id} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="comorfree"
                                value={option.name}
                                checked={selectOption === option.id}
                                onChange={() => setSelectOption(option.id)}
                                className={styles.radio}
                                required
                            />
                            <p className={styles.radioText}>{option.name}</p>
                        </label>
                    ))}
                </div>
            </div>

            <InputStrAndSmall
                title="会社名/屋号"
                type="text"
                value={companyName ?? ""}
                onChange={setCompanyName}
                placeholder="株式会社〇〇"
                hissu
                small="※個人事業主の方で屋号が無い場合、本名フルネームをご入力ください。"
            />

            <InputStrAndSmall
                title="ショップ名"
                type="text"
                value={shopName}
                onChange={setShopName}
                placeholder="〇〇〇〇"
                hissu
                small="※プロフィールに表示する店舗名を入力します。"
            />

            <InputStr
                title="電話番号"
                type="tel"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="電話番号"
                hissu
                patternNum
            />

            <InputStr
                title="代表メールアドレス"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="*****@****.***"
                hissu
            />

            <InputStr
                title="営業日（定休日）、営業時間"
                type="text"
                value={openDateTime ?? ""}
                onChange={setOpenDateTime}
                placeholder="平日9時～17時（土日祝は定休日）"
                hissu
            />

            <div className={styles.inputDiv}>
                <InputTitle title={`${selectOption === 1 ? "登記年月日" : "創業日"}`} hissu />

                <DatePicker
                    selected={foundedDate}
                    onChange={(date) => setFoundedDate(date || undefined)}
                    dateFormat="yyyy年MM月dd日"
                    locale={ja}
                    placeholderText="創業日を選択"
                    className={styles.input}
                    maxDate={new Date()}
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                    required
                />
            </div>

            <div className={styles.inputDiv}>
                <InputTitle title="従業員数" hissu />

                <input
                    type="number"
                    value={memberCount || ""}
                    onChange={(e) => setMemberCount(Number(e.target.value))}
                    className={styles.input}
                    placeholder="50"
                    required
                />
            </div>

            <InputStr
                title="ホームページURL（任意）"
                type="text"
                value={homepage || ""}
                onChange={setHomepage}
                placeholder="http://*******.***"
                hissu={false}
            />

            {selectOption === 1 && (
                <>
                    <InputStr
                        title="法人番号"
                        type="text"
                        value={companyNumber ?? ""}
                        onChange={setCompanyNumber}
                        placeholder="1122334455667"
                        hissu
                    />

                    <div className={styles.inputDiv}>
                        <InputTitle title="資本金" hissu />

                        <div className={styles.inputFlex}>
                            <p className={styles.text14}>￥</p>
                            <input
                                type="number"
                                value={capital || ""}
                                onChange={(e) => setCapital(Number(e.target.value))}
                                placeholder="3,000,000"
                                className={styles.input}
                                required
                            />
                        </div>
                    </div>
                </>
            )}

            <h2 className={styles.subtitle}>代表者氏名</h2>

            <div className={styles.nameFlex}>
                <InputStr title="姓" type="text" value={repSei || ""} onChange={setRepSei} placeholder="山田" hissu />
                <InputStr title="名" type="text" value={repMei || ""} onChange={setRepMei} placeholder="太郎" hissu />
            </div>

            <div className={styles.nameFlex}>
                <InputStr
                    title="セイ"
                    type="text"
                    value={repSeiKana || ""}
                    onChange={setRepSeiKana}
                    placeholder="ヤマダ"
                    hissu
                />
                <InputStr
                    title="メイ"
                    type="text"
                    value={repMeiKana || ""}
                    onChange={setRepMeiKana}
                    placeholder="タロウ"
                    hissu
                />
            </div>

            <h2 className={styles.subtitle}>担当者氏名</h2>

            <div className={styles.nameFlex}>
                <InputStr title="姓" type="text" value={conSei || ""} onChange={setConSei} placeholder="山田" hissu />
                <InputStr title="名" type="text" value={conMei || ""} onChange={setConMei} placeholder="太郎" hissu />
            </div>

            <div className={styles.nameFlex}>
                <InputStr
                    title="セイ"
                    type="text"
                    value={conSeiKana || ""}
                    onChange={setConSeiKana}
                    placeholder="ヤマダ"
                    hissu
                />
                <InputStr
                    title="メイ"
                    type="text"
                    value={conMeiKana || ""}
                    onChange={setConMeiKana}
                    placeholder="タロウ"
                    hissu
                />
            </div>

            <p className={clsx("mt-1", styles.centerSmall)}>
                ※代表者・担当者氏名は同一人物でも異なる人物でも構いません。
            </p>

            <h2 className={styles.subtitle}>住所</h2>

            <InputStr
                title="郵便番号 ※ハイフン無し"
                type="text"
                value={postNumber || ""}
                onChange={handlePostNumberChange}
                placeholder={SITE.inputPostNumber}
                hissu
                numeric
                patternNum
            />
            <InputStr
                title="都道府県"
                type="text"
                value={todouhuken || ""}
                onChange={setTodouhuken}
                placeholder={SITE.inputTodouhuken}
                hissu
            />
            <InputStr
                title="市区町村"
                type="text"
                value={shikutyouson || ""}
                onChange={setShikutyouson}
                placeholder={SITE.inputShikutyouson}
                hissu
            />
            <InputStr
                title="町名・番地"
                type="text"
                value={banchi || ""}
                onChange={setBanchi}
                placeholder={SITE.inputBanchi}
                hissu
            />
            <InputStr
                title="建物名・部屋番号"
                type="text"
                value={building || ""}
                onChange={setBuilding}
                placeholder={SITE.inputBuilding}
                hissu={false}
            />

            <h2 className={styles.subtitle}>利用規約・プライバシーポリシー</h2>

            <p className={styles.linkText}>
                事前に
                <Link href="/terms-and-conditions" className={styles.link}>
                    利用規約
                </Link>
                および
                <Link href="/privacy-policy" className={styles.link}>
                    プライバシーポリシー
                </Link>
                をご確認ください。
            </p>

            <label className={styles.checkLabel}>
                <input
                    type="checkbox"
                    name="checkbox"
                    checked={check}
                    onChange={() => setCheck(!check)}
                    className={styles.check}
                />
                <p className={styles.checkText}>利用規約およびプライバシーポリシーに同意します。</p>
            </label>

            <ButtonDiv nextClick={submit} backClick={backSubmit} />
        </SSUIBack>
    );
};
