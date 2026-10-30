"use client";

import { Button, InputTitle } from "@/components/inputForm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../../lib/api/apiError";
import { sleep } from "../../../../lib/sleep";
import { fetchOptionEdit } from "../../api/shop/shopInfo/client";
import styles from "../../edit.module.css";
import EditUI from "../../editUI";
import { ShopInfo } from "../../types";

type Props = {
    shopId: string;
    shopInfo: ShopInfo;
};

export const Form = ({ shopId, shopInfo }: Props) => {
    const [autoTrans, setAutoTrans] = useState(shopInfo.auto_trans ? "はい" : "いいえ");
    const [openInfo, setOpenInfo] = useState(shopInfo.open_info ? "はい" : "いいえ");

    const router = useRouter();

    const submit = async () => {
        const autoTransBoolean = autoTrans === "はい";
        const openInfoBoolean = openInfo === "はい";

        const body = {
            autoTrans: autoTransBoolean,
            openInfo: openInfoBoolean,
        };

        try {
            await fetchOptionEdit(shopId, body);

            toast.success("オプション設定を変更しました");
            await sleep(1500);

            router.push(`/shop-info/${shopId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("オプション設定変更に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <EditUI title="オプション選択">
            <section className={styles.radioSection}>
                <InputTitle title="自動振込：" />
                <div className={styles.radioColumn}>
                    <label className={styles.radioLabel}>
                        <input
                            type="radio"
                            name="autoTrans"
                            value="はい"
                            checked={autoTrans === "はい"}
                            onChange={(e) => setAutoTrans(e.target.value)}
                            className={styles.radio}
                        />
                        <p className={styles.radioText}>はい</p>
                    </label>

                    <label className={styles.radioLabel}>
                        <input
                            type="radio"
                            name="autoTrans"
                            value="いいえ"
                            checked={autoTrans === "いいえ"}
                            onChange={(e) => setAutoTrans(e.target.value)}
                            className={styles.radio}
                        />
                        <p className={styles.radioText}>いいえ</p>
                    </label>
                </div>
            </section>
            <p className={styles.centerSmall}>
                ※振込申請なしで、毎月の売上を翌月10日にお振込みいたします。（金融機関が休業日の場合、その翌営業日）
            </p>

            <section className={styles.radioSection}>
                <InputTitle title="運営者情報を表示する：" />
                <div className={styles.radioColumn}>
                    <label className={styles.radioLabel}>
                        <input
                            type="radio"
                            name="openInfo"
                            value="はい"
                            checked={openInfo === "はい"}
                            onChange={(e) => setOpenInfo(e.target.value)}
                            className={styles.radio}
                        />
                        <p className={styles.radioText}>はい</p>
                    </label>

                    <label className={styles.radioLabel}>
                        <input
                            type="radio"
                            name="openInfo"
                            value="いいえ"
                            checked={openInfo === "いいえ"}
                            onChange={(e) => setOpenInfo(e.target.value)}
                            className={styles.radio}
                        />
                        <p className={styles.radioText}>いいえ</p>
                    </label>
                </div>
            </section>
            <p className={styles.centerSmall}>
                ※ショップ情報に会社名、代表者・担当者氏名、所在地、電話番号、メールアドレス、ホームページURLを掲載します。運営者情報を表示しない場合、お客様から請求があったとき、遅滞なく開示するものとします。
            </p>

            <Button onClick={submit}>登録する</Button>
        </EditUI>
    );
};
