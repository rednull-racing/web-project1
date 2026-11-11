"use client";

import { ApiError } from "@/lib/api/apiError";
import { faEllipsisVertical, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import toast from "react-hot-toast";
import { KeyedMutator } from "swr";
import { ItemDraft } from "../types";
import { fetchRemoveItem } from "./api/client";
import styles from "./removeFloat.module.css";

type Response = {
    itemDraftList: ItemDraft[];
    totalPages: number;
};

type Props = {
    itemDraftId: string;
    mutate: KeyedMutator<Response>;
};

export const RemoveFloat = ({ itemDraftId, mutate }: Props) => {
    const [floatVisible, setFloatVisible] = useState(false);

    const remove = async (itemId: string) => {
        const removeBasePath = `items/${itemId}/draft`;
        // 楽観的更新
        mutate((currentData) => {
            if (!currentData) return currentData;
            return {
                ...currentData,
                itemDraftList: currentData.itemDraftList.filter((item) => item.id !== itemId),
            };
        }, false);

        const toastBaseText = "下書き商品";
        try {
            await fetchRemoveItem(removeBasePath);
            mutate();
            toast.success(`${toastBaseText}を削除しました`);
        } catch (err) {
            mutate(); // ロールバック
            if (err instanceof ApiError) {
                toast.error(`${toastBaseText}の削除に失敗しました`);
                return;
            }
            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const removeText = "下書きから削除";

    return (
        <>
            <FontAwesomeIcon
                icon={faEllipsisVertical}
                className={styles.ellipsisIcon}
                onClick={() => setFloatVisible(!floatVisible)}
            />

            {floatVisible && (
                <>
                    <div className={styles.overlay} onClick={() => setFloatVisible(false)} />

                    <div className={styles.float}>
                        <div className={styles.removeFlex} onClick={() => remove(itemDraftId)}>
                            <FontAwesomeIcon icon={faTrash} className={styles.trashIcon} />

                            <p className={styles.floatText}>{removeText}</p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
