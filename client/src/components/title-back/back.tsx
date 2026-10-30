"use client";

import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import styles from "./title-back.module.css";

type Props = {
    url?: string;
};

export const Back = ({ url }: Props) => {
    const router = useRouter();

    return (
        <button
            type="button"
            aria-label="戻る"
            className={clsx("mb-2", styles.backButton)}
            onClick={() => {
                if (url) {
                    router.push(url);
                    return;
                }

                router.back();
            }}
        >
            <FontAwesomeIcon icon={faAngleLeft} className={styles.back} aria-hidden="true" />
        </button>
    );
};
