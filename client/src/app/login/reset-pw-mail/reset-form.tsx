"use client";

import { useState } from "react";
import styles from "@/styles/login.module.css";
import toast from "react-hot-toast";
import { fetchRequestResetPw } from "../api/auth";

export const ResetForm = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");

    const handleSubmit = async () => {
        setLoading(true);

        const trimEmail = email.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimEmail)) {
            toast.error("正しいメールアドレスの形式で入力してください");

            setLoading(false);
            return;
        }

        try {
            await fetchRequestResetPw(trimEmail);

            toast.success("メールを送信しました");
            setEmail("");
            setLoading(false);
        } catch {
            toast.success("メールを送信しました");
            setEmail("");
            setLoading(false);
        }
    };

    const isDisabled = !email;

    return (
        <div>
            <p className={styles.formText}>メールアドレス</p>
            <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="****@****.***"
                className={styles.input}
                required
            />

            <button type="submit" className={styles.mainB} disabled={isDisabled} onClick={handleSubmit}>
                {loading ? "送信中..." : "メールを送信する"}
            </button>
        </div>
    );
};
