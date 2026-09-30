"use client";

import { ja } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DatePicker from "react-datepicker";
import { Button, InputStr, InputStrAndSmall, InputTitle } from "../../../../components/inputForm";
import styles from "../../edit.module.css";
import EditUI from "../../editUI";
import { ShopInfo } from "../../type";

type Props = {
    shopId: string;
    shop: ShopInfo;
};

export const ShopOtherEditForm = ({ shopId, shop }: Props) => {
    const [shopName, setShopName] = useState(shop.shop_name ?? "");
    const [openDateTime, setOpenDateTime] = useState(shop.open_date_time ?? "");
    const [foundedDate, setFoundedDate] = useState<Date | undefined>(shop.founded_date ?? "");
    const [memberCount, setMemberCount] = useState(shop.member_count ?? "");
    const [homepage, setHomepage] = useState(shop.homepage_url ?? "");

    const [companyNumber, setCompanyNumber] = useState(shop.company_number ?? "");
    const [capital, setCapital] = useState(shop.capital);

    const router = useRouter();

    const submit = async () => {
        const body = {
            shopName,
            openDateTime,
            foundedDate,
            memberCount,
            homepage,
            companyNumber,
            capital,
        };
    };

    const comFree = shop.ComOrFreeOption?.id === 1;

    const foundDateTitle = comFree ? "登記年月日" : "創業日";

    return (
        <EditUI title="その他ショップ情報変更">
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
                title="営業日（定休日）、営業時間"
                type="text"
                value={openDateTime ?? ""}
                onChange={setOpenDateTime}
                placeholder="平日9時～17時（土日祝は定休日）"
                hissu
            />

            <div className={styles.inputDiv}>
                <InputTitle title={foundDateTitle} hissu />

                <DatePicker
                    selected={foundedDate}
                    onChange={(date) => setFoundedDate(date ?? undefined)}
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

            {comFree && (
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

            <Button onClick={submit}>送信する</Button>
        </EditUI>
    );
};
