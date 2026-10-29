"use client";

import { useRouter } from "next/navigation";
import { useOperation } from "../../../components/operation/operation";
import toast from "react-hot-toast";
import { fetchEditDraftItem } from "./api/client";
import styles from "./draft.module.css";

type Props = {
    id: string;
};

export const EditButton = ({ id }: Props) => {
    const router = useRouter();
    const operation = useOperation();

    const edit = async () => {
        if (!operation.acquire()) return;
        try {
            const data = await fetchEditDraftItem(id);
            router.push(`/upload/${data.itemEditingId}`);
        } catch {
            toast.error("下書きの編集を開始できませんでした。時間を置いて再試行してください");
            operation.release();
        }
    };

    return (
        <button type="button" onClick={edit} disabled={operation.busy} className={styles.editButton}>
            編集する
        </button>
    );
};
