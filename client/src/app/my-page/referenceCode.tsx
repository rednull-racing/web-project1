"use client";

import { X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../lib/api/apiError";
import { fetchCodeOutput } from "./api/referenceCode";
import styles from "./mypage.module.css";

type Props = {
    itemCount: number;
    referenceCount: number;
};

export const ReferenceCode = ({ itemCount, referenceCount }: Props) => {
    const [visiblePopup, setVisiblePopup] = useState(false);
    const [referenceCodeOutput, setReferenceCodeOutput] = useState<string | null>(null);

    const outputReferenceCode = async () => {
        try {
            const data = await fetchCodeOutput();

            setReferenceCodeOutput(data.output);
            setVisiblePopup(true);
        } catch (err) {
            if (err instanceof ApiError) return;

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <>
            {itemCount > 0 && referenceCount < 3 && (
                <div className={styles.linkElem} onClick={outputReferenceCode}>
                    <p>紹介コード発行</p>
                </div>
            )}

            {visiblePopup && referenceCodeOutput && (
                <>
                    <div className={styles.overlay} onClick={() => setVisiblePopup(false)} />

                    <div className={styles.popup}>
                        <X strokeWidth={1.5} onClick={() => setVisiblePopup(false)} className={styles.x} />
                        <p className={styles.popupTitle}>紹介コード発行</p>
                        <p
                            className={styles.output}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(referenceCodeOutput);
                                    toast.success("コピーしました");
                                } catch {
                                    toast.error("コピー失敗しました。");
                                }
                            }}
                        >
                            {referenceCodeOutput}
                        </p>
                        <p className={styles.popupText}>コードをクリックするとコピーできます。</p>
                        <small className={styles.popupSmall}>
                            ※ 紹介コードを入力したユーザーが商品を出品しない限り、ポイントは付与されません。
                        </small>
                    </div>
                </>
            )}
        </>
    );
};
