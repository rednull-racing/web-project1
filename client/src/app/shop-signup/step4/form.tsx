"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchStep4 } from "../api/step4";
import { ButtonDiv } from "../buttonDiv";
import styles from "../ss.module.css";
import SSUI from "../ssUI";
import { StepBar } from "../stepBar";

type Props = {
    shopSignupId: string;
};

export const Form = ({ shopSignupId }: Props) => {
    const [autoTrans, setAutoTrans] = useState("いいえ");
    const [openInfo, setOpenInfo] = useState("いいえ");

    const router = useRouter();

    const submit = async () => {
        const autoTransBoolean = autoTrans === "はい";
        const openInfoBoolean = openInfo === "はい";

        const body = {
            autoTrans: autoTransBoolean,
            openInfo: openInfoBoolean,
        };

        try {
            await fetchStep4(shopSignupId, body);

            toast.success("オプションを設定しました");
            await sleep(1500);

            router.push(`/shop-signup/step5/${shopSignupId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("オプション設定に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const backSubmit = () => router.push(`/shop-signup/step3/${shopSignupId}`);

    return (
        <SSUI title="オプション選択">
            <StepBar />

            <div className={styles.optionDiv}>
                <div className={styles.radioFlexOption}>
                    <p className={styles.text14}>自動振込を希望する</p>

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
                </div>

                <p className={styles.centerSmall}>
                    ※振込申請なしで、毎月の売上を翌月10日にお振込みいたします。（金融機関が休業日の場合、その翌営業日）
                </p>
            </div>

            <div className={styles.optionDiv}>
                <div className={styles.radioFlexOption}>
                    <p className={styles.text14}>運営者情報を表示する</p>

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
                </div>

                <p className={styles.centerSmall}>
                    ※ショップ情報に会社名、代表者・担当者氏名、所在地、電話番号、メールアドレス、ホームページURLを掲載します。運営者情報を表示しない場合、お客様から請求があったとき、遅滞なく開示するものとします。
                </p>
            </div>

            <ButtonDiv nextClick={submit} backClick={backSubmit} />
        </SSUI>
    );
};
