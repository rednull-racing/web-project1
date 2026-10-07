"use client";

import { getAccessToken } from "@/lib/getAccessToken";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import styles from "../upload.module.css";
import UploadUI from "../uploadUI";

export const Client = () => {
    const router = useRouter();

    const newItem = async () => {
        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                alert("認証に失敗しました。時間を置いて再試行するか、再度ログインしてください");
                return;
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/item-editing`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error("通信エラーが発生しました");
                return;
            }

            const itemEditingId = data.itemEditingId;

            router.push(`/upload/${itemEditingId}`);
        } catch {
            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <UploadUI title="出品する">
            <button type="button" onClick={newItem} className={styles.newItemButton}>
                新しく出品する
            </button>

            <Link href="/item-list/draft" className={styles.draftListButton}>
                下書き一覧
            </Link>
        </UploadUI>
    );
};
