"use client";

import { ApiError } from "@/lib/api/apiError";
import { faEllipsisVertical, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import toast from "react-hot-toast";
import { KeyedMutator } from "swr";
import { Item } from "../types";
import { fetchRemoveItem } from "./api/client";
import styles from "./removeFloat.module.css";

type Response = {
    itemList: Item[];
    totalPages: number;
};

type Props = {
    item: Item;
    mutate: KeyedMutator<Response>;
};

export const RemoveFloat = ({ item, mutate }: Props) => {
    const [floatVisible, setFloatVisible] = useState(false);

    const remove = async (itemId: string) => {
        const removeBasePath = `watch-history/${itemId}`;

        // 楽観的更新
        mutate((currentData) => {
            if (!currentData) return currentData;
            return {
                ...currentData,
                itemList: currentData.itemList.filter((item) => item.id !== itemId),
            };
        }, false);

        const toastBaseText = "閲覧履歴";

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

    const removeText = "閲覧履歴から削除";

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
                        <div className={styles.removeFlex} onClick={() => remove(item.id)}>
                            <FontAwesomeIcon icon={faTrash} className={styles.trashIcon} />

                            <p className={styles.floatText}>{removeText}</p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
