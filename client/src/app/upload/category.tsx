"use client";

import { InputTitle } from "@/components/inputForm";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Categories } from "./types/types";
import styles from "./upload.module.css";

export type CategoryValue = {
    id: string | null;
    name: string;
    parent_id: number | null;
    level: number;
};

type Props = {
    level1List: Categories[];
    value: CategoryValue;
    onChange: (v: CategoryValue) => void;
    onConstraintChange: (
        c: {
            allowed_gender: "men" | "women" | "unisex" | null;
            allowed_age: "adult" | "kids" | "both" | null;
        } | null,
    ) => void;
};

export const Category = ({ level1List, value, onChange, onConstraintChange }: Props) => {
    const [level2List, setLevel2List] = useState<Categories[]>([]);
    const [selectedLevel1, setSelectedLevel1] = useState<CategoryValue | null>(null);
    const [displayLevel1, setDisplayLevel1] = useState("");
    const [displayLevel2, setDisplayLevel2] = useState("");
    const [loading, setLoading] = useState(false);
    const [openLevel1, setOpenLevel1] = useState(false);
    const [openLevel2, setOpenLevel2] = useState(false);

    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;

        if (value.level === 1) {
            setSelectedLevel1(value);
            setDisplayLevel1(value.name);
            setDisplayLevel2("");

            const cat = level1List.find((c) => c.id === value.id);
            if (cat) {
                onConstraintChange({
                    allowed_gender: cat.allowed_gender ?? null,
                    allowed_age: cat.allowed_age ?? null,
                });
            }
        }

        if (value.level === 2 && value.parent_id) {
            const parent = level1List.find((cat) => Number(cat.id) === Number(value.parent_id));

            if (parent) {
                const parentCategoryValue: CategoryValue = {
                    id: parent.id,
                    name: parent.name,
                    parent_id: null,
                    level: 1,
                };

                setDisplayLevel1(parent?.name ?? "");
                setSelectedLevel1(parentCategoryValue);
                setDisplayLevel2(value.name);

                onConstraintChange({
                    allowed_gender: parent.allowed_gender ?? null,
                    allowed_age: parent.allowed_age ?? null,
                });

                fetchLevel2(value.parent_id);
            }
        }

        initializedRef.current = true;
    }, [value, level1List]);

    const NONE_CATEGORY: CategoryValue = {
        id: null,
        name: "選択しない",
        parent_id: null,
        level: 2,
    };

    const handleLevel1Set = (cat: Categories) => {
        setLoading(true);
        setSelectedLevel1(cat);

        onChange({
            id: cat.id,
            name: cat.name,
            parent_id: null,
            level: 1,
        });

        onConstraintChange({
            allowed_gender: cat.allowed_gender,
            allowed_age: cat.allowed_age,
        });

        setDisplayLevel1(cat.name);
        setDisplayLevel2("");
        setOpenLevel1(false);

        const idNum = Number(cat.id);

        fetchLevel2(idNum);
    };

    const fetchLevel2 = async (parentId: number) => {
        setLoading(true);
        setLevel2List([]);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${parentId}/level2`, {
                cache: "no-store",
            });

            const data = await res.json();

            if (!res.ok) {
                console.error(data.message);
                toast.error("詳細カテゴリーの取得に失敗しました。");
                setLoading(false);
                return;
            }

            const category2 = data.category2;

            setLevel2List([...category2, NONE_CATEGORY]);

            setLoading(false);
        } catch (err) {
            toast.error("詳細カテゴリーの取得に失敗しました。");
            console.error(err);
            setLoading(false);
        }
    };

    const handleLevel2Set = (cat: Categories) => {
        const display1 = displayLevel1;

        if (cat.id === null) {
            if (!selectedLevel1) return;

            onChange({
                id: selectedLevel1.id,
                name: selectedLevel1.name,
                parent_id: null,
                level: 1,
            });

            setDisplayLevel2("選択しない");
            setOpenLevel2(false);
            return;
        }

        onChange({
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
            level: 2,
        });

        onConstraintChange({
            allowed_gender: cat.allowed_gender,
            allowed_age: cat.allowed_age,
        });

        setDisplayLevel2(cat.name);
        setOpenLevel2(false);
        setDisplayLevel1(display1);
    };

    return (
        <div className={styles.twoColumnWrapper}>
            {/* category1 */}
            <div className={styles.selectColumn}>
                <InputTitle title="カテゴリー" hissu />

                <input
                    type="text"
                    value={displayLevel1}
                    placeholder="カテゴリーを選択してください"
                    className={styles.input}
                    readOnly
                    required
                    onFocus={() => setOpenLevel1(true)}
                    onBlur={() => setOpenLevel1(false)}
                />

                {openLevel1 && (
                    <ul className={styles.selectUl}>
                        {level1List.map((cat) => (
                            <li
                                key={cat.id}
                                onMouseDown={() => handleLevel1Set(cat)}
                                data-selected={displayLevel1 === cat.name}
                                className={styles.selectLi}
                            >
                                {cat.name}
                                <span className={styles.chevron}>›</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* category2 */}
            {displayLevel1 !== "" && (
                <div className={styles.selectColumn}>
                    <InputTitle title="詳細カテゴリー" />

                    <input
                        type="text"
                        value={displayLevel2}
                        placeholder="カテゴリーを選択してください"
                        className={styles.input}
                        readOnly
                        onFocus={() => setOpenLevel2(true)}
                        onBlur={() => setOpenLevel2(false)}
                    />

                    {!loading && openLevel2 && (
                        <ul className={styles.selectUl}>
                            {level2List.map((cat) => (
                                <li
                                    key={cat.id}
                                    onMouseDown={() => handleLevel2Set(cat)}
                                    data-selected={displayLevel2 === cat.name}
                                    className={styles.selectLi}
                                >
                                    {cat.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};
