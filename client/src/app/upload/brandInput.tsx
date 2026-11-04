"use client";

import { InputTitle } from "@/components/inputForm";
import { useEffect, useRef, useState } from "react";
import styles from "./upload.module.css";

export type BrandValue = {
    id: string | null;
    name: string;
};

type Props = {
    value: BrandValue;
    onChange: (v: BrandValue) => void;
};

export const BrandInput = ({ value, onChange }: Props) => {
    const [brandName, setBrandName] = useState("");
    const [openSuggest, setOpenSuggest] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);

    const [suggestions, setSuggestions] = useState<
        {
            id: string;
            name: string;
            name_normalized: string;
        }[]
    >([]);

    const requestVersion = useRef(0);
    const selectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            requestVersion.current++;
            if (selectionTimeout.current) clearTimeout(selectionTimeout.current);
            if (blurTimeout.current) clearTimeout(blurTimeout.current);
        },
        [],
    );
    const suggestTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (value.id) {
            setBrandName(value.name);
        }
    }, [value.id, value.name]);

    useEffect(() => {
        const version = ++requestVersion.current;
        if (brandName.length === 0) {
            setSuggestions([]);
            return;
        }
        if (isSelecting) {
            setSuggestions([]);
            return;
        }

        if (suggestTimeout.current) clearTimeout(suggestTimeout.current);

        suggestTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/brands/suggest?${new URLSearchParams({ keyword: brandName })}`,
                    {
                        cache: "no-store",
                    },
                );

                const data = await res.json();
                if (version !== requestVersion.current) return;

                if (!res.ok) {
                    console.error("ブランド名検索エラー：", data.message);
                    setSuggestions([]);
                    setOpenSuggest(false);
                    return;
                }

                setSuggestions(data.brands);
            } catch (err) {
                if (version !== requestVersion.current) return;
                console.error(err);
                setSuggestions([]);
            }
        }, 300);

        return () => {
            requestVersion.current++;
            if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
        };
    }, [brandName, isSelecting, value.name]);

    const handleChangeBrand = (name: string) => {
        requestVersion.current++;
        setIsSelecting(false);
        setBrandName(name);

        onChange({
            id: null,
            name,
        });
    };

    return (
        <div className={styles.selectDiv}>
            <InputTitle title="ブランド名を入力" />
            <input
                type="text"
                value={brandName}
                onChange={(e) => handleChangeBrand(e.target.value)}
                placeholder="ブランド名を入力"
                onFocus={() => setOpenSuggest(true)}
                onBlur={() => {
                    blurTimeout.current = setTimeout(() => setOpenSuggest(false), 150);
                }}
                className={styles.input}
            />

            {openSuggest && suggestions.length > 0 && (
                <ul className={styles.selectUl}>
                    {suggestions.map((brand, i) => (
                        <li
                            key={i}
                            onMouseDown={() => {
                                requestVersion.current++;
                                setIsSelecting(true);
                                setBrandName(brand.name);
                                onChange({
                                    id: brand.id,
                                    name: brand.name,
                                });
                                setOpenSuggest(false);

                                selectionTimeout.current = setTimeout(() => setIsSelecting(false), 500);
                            }}
                            className={styles.selectLi}
                        >
                            {brand.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
