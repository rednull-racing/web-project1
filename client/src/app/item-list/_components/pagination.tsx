"use client";

import { faAnglesLeft, faAnglesRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./listParts.module.css";

export const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const delta = typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1;
    pages.push(1);

    if (currentPage - delta > 2) pages.push("...");

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        pages.push(i);
    }

    if (currentPage + delta < totalPages - 1) pages.push("...");

    if (totalPages > 1) pages.push(totalPages);

    return (
        <div className={styles.pagination}>
            <button
                type="button"
                disabled={currentPage === 1}
                className={styles.pageButtonIcon}
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                title="前へ"
            >
                <FontAwesomeIcon icon={faAnglesLeft} className={styles.pageIcon} />
            </button>

            {pages.map((p, idx) =>
                p === "..." ? (
                    <span key={idx} className={styles.ellipsis}>
                        ...
                    </span>
                ) : (
                    <button
                        type="button"
                        key={idx}
                        className={`${styles.pageButton} ${currentPage === p ? styles.active : ""}`}
                        onClick={() => onPageChange(p as number)}
                    >
                        {p}
                    </button>
                ),
            )}

            <button
                type="button"
                disabled={currentPage === totalPages}
                className={styles.pageButtonIcon}
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                title="次へ"
            >
                <FontAwesomeIcon icon={faAnglesRight} className={styles.pageIcon} />
            </button>
        </div>
    );
};
