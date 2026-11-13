"use client";

import { NormalLinkContainer } from "@/components/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchCookieClear } from "./api/auth";
import styles from "./mypage.module.css";

export const Logout = () => {
    const router = useRouter();

    const logout = async () => {
        try {
            await signOut({
                redirect: false,
            });

            await fetchCookieClear();

            router.push("/");
        } catch {
            alert("システムエラーが発生しました。時間をおいて再試行してください。");
        }
    };

    return (
        <NormalLinkContainer>
            <div className={styles.linkElem} onClick={logout}>
                <p className={styles.red}>ログアウト</p>
            </div>
        </NormalLinkContainer>
    );
};
