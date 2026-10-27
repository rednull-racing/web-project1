"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchDeleteLogicalItem } from "../api/deleteItem";
import styles from "./seller.module.css";

type Props = {
    id: string;
};

export const DeleteItem = ({ id }: Props) => {
    const [popup, setPopup] = useState(false);
    const router = useRouter();

    const deleteItem = async () => {
        try {
            await fetchDeleteLogicalItem(id);

            toast.success("商品を削除しました");
            setPopup(false);
            await sleep(1500);

            router.push(`/item/deleted/${id}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("商品の削除に失敗しました");
                setPopup(false);

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
            setPopup(false);
        }
    };

    return (
        <>
            <p className={styles.deleteText} onClick={() => setPopup(true)}>
                この商品を削除する
            </p>

            {popup && (
                <>
                    <div className={styles.overlay} onClick={() => setPopup(false)} />

                    <div className={styles.popup}>
                        <X className={styles.x} onClick={() => setPopup(false)} />

                        <p className={styles.popupTitle}>確認</p>
                        <p className={styles.text13}>
                            ※
                            本当にこの商品を削除しますか？削除した場合、商品データが無くなってしまいます。（売上金は無くなりません）
                        </p>

                        <button type="button" className={styles.popupButton} onClick={deleteItem}>
                            削除する
                        </button>
                    </div>
                </>
            )}
        </>
    );
};
