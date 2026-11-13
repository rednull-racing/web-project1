"use client";

import { sleep } from "@/lib/sleep";
import styles from "@/styles/login.module.css";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export const VerifyForm = () => {
    const [code, setCode] = useState("");
    const [referenceCode, setReferenceCode] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [referenceVisible, setReferenceVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        setLoading(true);

        const trimCode = code.trim();
        if (!trimCode || trimCode === "") {
            toast.error("認証コードを入力してください");

            setLoading(false);
            return;
        }

        const trimReferenceCode = referenceCode.trim();

        try {
            const res = await signIn("verify", {
                verificationCode: trimCode,
                rememberMe,
                referenceCode: trimReferenceCode || undefined,
                redirect: false,
            });

            setCode("");
            setReferenceCode("");
            setRememberMe(false);
            setReferenceVisible(false);

            setLoading(false);

            if (res?.error) {
                toast.error("認証に失敗しました");
                return;
            }

            toast.success("認証成功しました");
            await sleep(1500);

            router.push("/my-page");
        } catch {
            alert("システムエラーが発生しました。時間をおいて再試行してください");

            setCode("");
            setReferenceCode("");
            setReferenceVisible(false);

            setLoading(false);
        }
    };

    const isDisabled = loading || !code;

    return (
        <div>
            <p className={styles.formText}>認証コード</p>
            <input
                type="text"
                name="verify-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                minLength={6}
                maxLength={6}
                className={styles.input}
                required
            />

            <label className={styles.checkLabel}>
                <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={styles.checkbox}
                />
                <p className={styles.checkText}>ログイン状態を保持する</p>
            </label>

            <button type="submit" className={styles.mainB} disabled={isDisabled} onClick={handleSubmit}>
                {loading ? "認証中..." : "認証する"}
            </button>

            <p className={styles.reference} onClick={() => setReferenceVisible((v) => !v)}>
                紹介コードを入力する（ここをクリック）
            </p>

            {referenceVisible && (
                <div className="mt-2">
                    <input
                        type="text"
                        name="reference-code"
                        onChange={(e) => setReferenceCode(e.target.value)}
                        placeholder="a1b2c3d4e5"
                        className={styles.input}
                    />
                    <small className={styles.superSmall}>
                        ※商品を出品後、弊社が確認でき次第、ポイントが付与されます。（目安：3営業日以内）
                        <br />
                        ※入力ミスなど間違いがあった場合、ポイントを付与できません。
                    </small>
                </div>
            )}
        </div>
    );
};
