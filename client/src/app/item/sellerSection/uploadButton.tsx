"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { fetchCopyUpload } from "../api/copyUpload";
import styles from "./seller.module.css";

type Props = {
    id: string;
};

export const UploadButton = ({ id }: Props) => {
    const router = useRouter();

    const copy = async (status: "normal" | "edit") => {
        try {
            const data = await fetchCopyUpload(id, status);

            const url = status === "edit" ? `/upload/edit/${data.itemEditingId}` : `/upload/${data.itemEditingId}`;
            router.push(url);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("サーバーエラーが発生しました。時間を置いて再試行してください");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください。");
        }
    };

    return (
        <div className={styles.buttonDiv}>
            <button type="button" className={styles.grayButton} onClick={() => copy("normal")}>
                コピー出品
            </button>
            <button type="button" className={clsx(styles.grayButton, styles.edit)} onClick={() => copy("edit")}>
                商品を編集する
            </button>
        </div>
    );
};
