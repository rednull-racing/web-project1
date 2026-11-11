"use client";

import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ChangeEventHandler } from "react";
import styles from "./listParts.module.css";

export const SearchField = ({
    searchValue,
    onChange,
    onSubmit,
}: {
    searchValue: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onSubmit: () => void;
}) => (
    <section className={styles.searchSection}>
        <input
            type="text"
            name="itemList_search"
            placeholder="検索"
            className={styles.searchInput}
            value={searchValue}
            onChange={onChange}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    onSubmit();
                }
            }}
            autoComplete="off"
        />
        <FontAwesomeIcon
            icon={faSearch}
            name="search_icon"
            className={`
                ${styles.searchIcon} 
                ${searchValue.trim() ? styles.activeIcon : ""}
            `}
            onClick={() => {
                onSubmit();
            }}
        />
    </section>
);
