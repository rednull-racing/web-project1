"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../lib/api/apiError";
import { sleep } from "../../lib/sleep";
import { fetchAddPenalty, fetchDeleteUser, fetchGetAdminProfile, fetchUriageDecrease } from "./api/admin";
import styles from "./profile-admin.module.css";
import { User } from "./profileTypes";

type Props = {
    userId: string;
    adminPage: boolean;
};

export const AdminSection = ({ userId, adminPage }: Props) => {
    const [data, setData] = useState<User | null>(null);
    const [popup, setPopup] = useState(false);
    const [addPenalty, setAddPenalty] = useState(0);
    const [deleteUriage, setDeleteUriage] = useState(0);
    const [deleteReason, setDeleteReason] = useState("");
    const router = useRouter();

    useEffect(() => {
        if (!adminPage) {
            router.push(`/profile/${userId}`);
            return;
        }

        const fetchData = async () => {
            try {
                const data = await fetchGetAdminProfile(userId);

                setData(data.user);
            } catch {
                router.push(`/profile/${userId}`);
                return;
            }
        };

        fetchData();
    }, [userId, adminPage, router]);

    const submitPenalty = async (addPenalty: number) => {
        if (addPenalty === 0) {
            toast.error("ペナルティポイントを入力してください");
            return;
        }

        try {
            await fetchAddPenalty(userId, addPenalty);

            setData((prev) => (prev ? { ...prev, penalty_points: prev.penalty_points + addPenalty } : prev));
            toast.success("ペナルティポイントを付与しました");
            await sleep(1000);

            setAddPenalty(0);
            setPopup(false);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("ペナルティポイントの追加に失敗しました");
                await sleep(1000);

                setAddPenalty(0);
                setPopup(false);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const uriageDecrease = async (deleteUriage: number) => {
        if (deleteUriage === 0) {
            toast.error("数値を入力してください");
            return;
        }

        try {
            await fetchUriageDecrease(userId, deleteUriage);

            setData((prev) => (prev ? { ...prev, uriagekin: prev.uriagekin - deleteUriage } : prev));
            toast.success("売上金を没収しました");
            await sleep(1000);

            setDeleteUriage(0);
            setPopup(false);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("売上金の削除に失敗しました");
                await sleep(1000);

                setDeleteUriage(0);
                setPopup(false);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const deleteUser = async (deleteReason: string) => {
        try {
            await fetchDeleteUser(userId, deleteReason);

            toast.success("ユーザーを削除しました");
            await sleep(2000);

            setDeleteReason("");
            setPopup(false);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("ユーザーの削除に失敗しました");
                await sleep(2000);

                setDeleteReason("");
                setPopup(false);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <>
            <div className="text-center">
                <p>
                    ペナルティポイント：<span className="font-bold">{data?.penalty_points}ポイント</span>
                </p>
                <button type="button" className={clsx("mt-4 mb-4", styles.adButton)} onClick={() => setPopup(true)}>
                    売上金没収/削除
                </button>
            </div>

            {popup && (
                <>
                    <div className={styles.overlay} onClick={() => setPopup(false)} />

                    <div className={styles.popup}>
                        <X strokeWidth={1.5} className={styles.x} onClick={() => setPopup(false)} />

                        <div className={styles.inputDiv}>
                            <p className={styles.inputTitle}>ペナルティポイント</p>

                            <input
                                type="number"
                                name="addPenalty"
                                value={addPenalty}
                                onChange={(e) => setAddPenalty(Number(e.target.value))}
                                placeholder="ペナルティポイント"
                                className={styles.input}
                                required
                            />

                            <p className={styles.currentNumber}>
                                現在のペナルティポイント： <strong>{data?.penalty_points}</strong>
                            </p>

                            <button
                                type="button"
                                className={styles.popupButton}
                                onClick={() => submitPenalty(addPenalty)}
                            >
                                ペナルティ付与
                            </button>
                        </div>

                        <div className={styles.inputDiv}>
                            <p className={styles.inputTitle}>売上金没収</p>

                            <input
                                type="number"
                                name="deleteUriage"
                                value={deleteUriage}
                                onChange={(e) => {
                                    const value = Number(e.target.value);
                                    if (data?.uriagekin !== undefined && value > data.uriagekin) {
                                        setDeleteUriage(data.uriagekin);
                                    } else {
                                        setDeleteUriage(value);
                                    }
                                }}
                                placeholder="没収金額"
                                className={styles.input}
                                required
                                max={data?.uriagekin}
                            />

                            <p className={styles.currentNumber}>
                                現在の売上金： <strong>{data?.uriagekin}</strong>
                            </p>

                            <button
                                type="button"
                                className={styles.popupButton}
                                onClick={() => uriageDecrease(deleteUriage)}
                            >
                                売上金没収
                            </button>
                        </div>

                        <div className={styles.inputDiv}>
                            <p className={styles.inputTitle}>削除</p>

                            <input
                                type="text"
                                name="deleteReason"
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="削除理由"
                                className={styles.input}
                                required
                            />

                            <button
                                type="button"
                                className={styles.popupButton}
                                onClick={() => deleteUser(deleteReason)}
                            >
                                削除する
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
