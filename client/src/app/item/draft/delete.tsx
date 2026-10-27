"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchDeleteDraftItem } from "./api/client";
import styles from "./draft.module.css";

type Props = {
    id: string;
};

export const DeleteItemDraft = ({ id }: Props) => {
    const [popup, setPopup] = useState(false);
    const router = useRouter();

    const deleteItem = async () => {
        try {
            await fetchDeleteDraftItem(id);

            toast.success("下書き商品を削除しました");
            setPopup(false);
            await sleep(1500);

            router.push("/my-page");
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("下書き商品の削除に失敗しました");
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
                この下書き商品を削除する
            </p>

            {popup && (
                <>
                    <div className={styles.overlay} onClick={() => setPopup(false)} />

                    <div className={styles.popup}>
                        <X className={styles.x} onClick={() => setPopup(false)} />

                        <p className={styles.popupTitle}>確認</p>
                        <p className={styles.text13}>※ 本当にこの下書き商品を削除しますか？</p>

                        <button type="button" className={styles.popupButton} onClick={deleteItem}>
                            削除する
                        </button>
                    </div>
                </>
            )}
        </>
    );
};
