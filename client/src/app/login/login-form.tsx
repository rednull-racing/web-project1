"use client";

import { sleep } from "@/lib/sleep";
import styles from "@/styles/login.module.css";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export const LoginForm = () => {
    const [visible, setVisible] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        setLoading(true);

        const trimEmail = email.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimEmail)) {
            toast.error("正しいメールアドレスの形式で入力してください");
            return;
        }

        try {
            const res = await signIn("credentials", {
                redirect: false,
                email: trimEmail,
                password,
                rememberMe: rememberMe ? "true" : "false",
            });

            setEmail("");
            setPassword("");
            setVisible(false);
            setLoading(false);
            setRememberMe(false);

            if (res?.error) {
                toast.error("メールアドレスまたはパスワードが正しくありません");
            } else if (res?.ok) {
                toast.success("ログインしました");
                await sleep(1200);

                router.push("/my-page");
            }
        } catch {
            alert("システムエラーが発生しました。時間をおいて再試行してください");
            setPassword("");
            setVisible(false);
            setLoading(false);
        }
    };

    const isDisabled = loading || !email || !password;

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

            <div className="mt-6">
                <p className={styles.formText}>パスワード</p>
                <div className="relative">
                    <input
                        type={visible ? "text" : "password"}
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="********"
                        className={styles.input}
                        required
                    />
                    <FontAwesomeIcon
                        icon={visible ? faEyeSlash : faEye}
                        onClick={() => setVisible((v) => !v)}
                        className={styles.icon}
                    />
                </div>
            </div>

            <label className={styles.checkLabel}>
                <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={styles.checkbox}
                />
                <span className={styles.checkText}>ログイン状態を保持する</span>
            </label>

            <button type="submit" className={styles.mainB} disabled={isDisabled} onClick={handleSubmit}>
                {loading ? "ログイン中..." : "ログインする"}
            </button>
        </div>
    );
};
