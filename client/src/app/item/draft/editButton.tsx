"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { fetchEditDraftItem } from "./api/client";
import styles from "./draft.module.css";

type Props = {
    id: string;
};

export const EditButton = ({ id }: Props) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const edit = async () => {
        if (loading) return;

        setLoading(true);
        try {
            const data = await fetchEditDraftItem(id);
            router.push(`/upload/${data.itemEditingId}`);
        } catch {
            toast.error("下書きの編集を開始できませんでした。時間を置いて再試行してください");
            setLoading(false);
        }
    };

    return (
        <button type="button" onClick={edit} disabled={loading} className={styles.editButton}>
            編集する
        </button>
    );
};
