"use client";

import { normalizeJapanese } from "@/lib/normalizeJapanese";
import { faClock, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchGetSearchHistory } from "./api/search";
import { fetchGetSuggestWords } from "./api/suggestWords";
import styles from "./header.module.css";

type Props = {
    loggedIn: boolean;
};

export const SearchInputPC = ({ loggedIn }: Props) => {
    const [value, setValue] = useState("");
    const [isPC, setIsPC] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [searchHis, setSearchHis] = useState<string[] | null>([]);
    const [suggestList, setSuggestList] = useState<string[]>([]);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const router = useRouter();

    useEffect(() => {
        const checkWidth = () => setIsPC(window.innerWidth >= 768);
        checkWidth();
        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, []);

    useEffect(() => {
        if (!loggedIn || !isFocused) return;

        const searchHistory = async () => {
            try {
                const dataList = await fetchGetSearchHistory();

                setSearchHis(dataList);
            } catch {}
        };

        searchHistory();
    }, [loggedIn, isFocused]);

    if (!isPC) return null;

    const fetchSuggest = async (word: string) => {
        if (!word.trim()) {
            setSuggestList([]);
            return;
        }

        try {
            const suggest = await fetchGetSuggestWords(word);

            setSuggestList(suggest);
        } catch {
            setSuggestList([]);
        }
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setValue(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            fetchSuggest(val);
        }, 300);
    };

    const buildMapping = (str: string) => {
        const normalized = normalizeJapanese(str);

        const map: { origIndex: number; normStart: number; normEnd: number }[] = [];
        let normPos = 0;

        for (let i = 0; i < str.length; i++) {
            const origChar = str[i];
            const normChar = normalizeJapanese(origChar);

            const start = normPos;
            normPos += normChar.length;
            const end = normPos - 1;

            map.push({
                origIndex: i,
                normStart: start,
                normEnd: end,
            });
        }

        return { normalized, map };
    };

    const highlightMatch = (word: string, query: string) => {
        if (!query) return word;

        const { normalized: nWord, map } = buildMapping(word);
        const nQuery = normalizeJapanese(query);

        const normIndex = nWord.indexOf(nQuery);
        if (normIndex === -1) return word;

        const startMap = map.find(
            (m) => m.normStart === normIndex || (m.normStart < normIndex && m.normEnd >= normIndex),
        );
        if (!startMap) return word;

        const startOrig = startMap.origIndex;

        const endNormIndex = normIndex + nQuery.length - 1;
        const endMap = map.find((m) => m.normStart <= endNormIndex && m.normEnd >= endNormIndex);
        if (!endMap) return word;

        const endOrig = endMap.origIndex;

        const before = word.slice(0, startOrig);
        const match = word.slice(startOrig, endOrig + 1);
        const after = word.slice(endOrig + 1);

        return (
            <>
                {before}
                <strong>{match}</strong>
                {after}
            </>
        );
    };

    return (
        <>
            <div className={styles.searchDivPC}>
                <form
                    className={styles.searchInputDivPC}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!value.trim()) return;
                        setSuggestList([]);
                        router.push(`/search?keyword=${encodeURIComponent(value)}`);
                        setValue("");
                    }}
                >
                    <input
                        type="text"
                        name="検索"
                        placeholder="検索"
                        className={styles.searchInputPC}
                        value={value}
                        onChange={onChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        autoComplete="off"
                    />
                    <FontAwesomeIcon
                        icon={faSearch}
                        className={`${styles.searchIcon} ${value ? styles.activeIcon : ""}`}
                        onClick={() => {
                            if (!value.trim()) return;
                            setSuggestList([]);
                            router.push(`/search?keyword=${encodeURIComponent(value)}`);
                            setValue("");
                        }}
                    />
                </form>
                <p className={styles.categorySearchPC}>
                    <Link href="/search/category">カテゴリー検索</Link>
                </p>

                {isFocused && (
                    <>
                        <div className={styles.suggestAreaPC}>
                            <div className={styles.suggestInnerPC}>
                                {suggestList.length === 0 &&
                                    searchHis?.map((v, i) => (
                                        <div
                                            key={i}
                                            className={styles.suggestItemPC}
                                            onMouseDown={() => {
                                                setValue(v);
                                                setSuggestList([]);
                                                router.push(`/search?keyword=${encodeURIComponent(v)}`);
                                                setIsFocused(false);
                                                setValue("");
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faClock} className={styles.hisIcon} />
                                            <p className={styles.suggestText}>{highlightMatch(v, value)}</p>
                                        </div>
                                    ))}

                                {suggestList.length > 0 &&
                                    suggestList?.map((v, i) => (
                                        <div
                                            key={i}
                                            className={styles.suggestItemPC}
                                            onMouseDown={() => {
                                                setValue(v);
                                                setSuggestList([]);
                                                router.push(`/search?keyword=${encodeURIComponent(v)}`);
                                                setIsFocused(false);
                                                setValue("");
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faSearch} className={styles.suggestSearchIcon} />
                                            <p className={styles.suggestText}>{highlightMatch(v, value)}</p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};
