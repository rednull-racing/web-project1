"use client";

import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import styles from "./title-back.module.css";

type pageTitleProps = {
    title: string;
    url?: string;
};

export const TitleAndBack = ({ title, url }: pageTitleProps) => {
    const router = useRouter();

    return (
        <div className="mb-2">
            <h1 className={styles.title}>{title}</h1>

            <button
                type="button"
                aria-label="戻る"
                className={styles.backButton}
                onClick={() => {
                    if (url) {
                        router.push(url);
                        return;
                    }
                    router.back();
                }}
            >
                <FontAwesomeIcon icon={faAngleLeft} className={styles.back} />
            </button>
        </div>
    );
};
