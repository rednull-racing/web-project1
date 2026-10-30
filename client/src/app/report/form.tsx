"use client";

import { Button, InputTitle } from "@/components/inputForm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../lib/api/apiError";
import { sleep } from "../../lib/sleep";
import { fetchReport } from "./api/report";
import styles from "./report.module.css";
import { Option } from "./types";

type Props = {
    id: string;
    options: Option[];
    page: "item" | "comment";
};

export const Form = ({ id, options, page }: Props) => {
    const [selected, setSelected] = useState<number | null>(null);

    const router = useRouter();

    const submit = async () => {
        if (!selected || selected === 0) {
            toast.error("報告内容が選択されていません");
            return;
        }

        const path =
            page === "item"
                ? `${process.env.NEXT_PUBLIC_API_URL}/item-report/${id}`
                : page === "comment"
                  ? `${process.env.NEXT_PUBLIC_API_URL}/comment-report/${id}`
                  : null;

        if (!path) {
            toast.error("報告の送信に失敗しました");
            return;
        }

        try {
            await fetchReport(path, selected);

            toast.success("報告を送信しました");
            await sleep(1500);

            router.back();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("報告の送信に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <>
            <section className={styles.radioSection}>
                <InputTitle title="報告内容を選択してください" hissu />

                <div className={styles.radioColumn}>
                    {options.map((option) => (
                        <label key={option.id} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="report"
                                value={option.name}
                                checked={selected === option.id}
                                onChange={() => setSelected(option.id)}
                                className={styles.radio}
                                required
                            />
                            <p className={styles.radioText}>{option.name}</p>
                        </label>
                    ))}
                </div>
            </section>

            <Button onClick={submit}>報告する</Button>
        </>
    );
};
