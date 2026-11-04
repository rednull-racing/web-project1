"use client";

import { InputTitle } from "@/components/inputForm";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import styles from "./upload.module.css";

export type GenderAgeValue = {
    gender_type: "men" | "women" | "unisex" | null;
    age_type: "adult" | "kids" | "both" | null;
};

type Props = {
    value: GenderAgeValue;
    onChange: (v: GenderAgeValue) => void;
    categoryConstraint: {
        allowed_gender: "men" | "women" | "unisex" | null;
        allowed_age: "adult" | "kids" | "both" | null;
    } | null;
};

export const GenderAge = ({ value, onChange, categoryConstraint }: Props) => {
    const genderOptions = useMemo(() => {
        const allowed = categoryConstraint?.allowed_gender;
        return !allowed || allowed === "unisex" ? ["men", "women", "unisex"] as const : [allowed];
    }, [categoryConstraint?.allowed_gender]);
    const ageOptions = useMemo(() => {
        const allowed = categoryConstraint?.allowed_age;
        return !allowed || allowed === "both" ? ["adult", "kids", "both"] as const : [allowed];
    }, [categoryConstraint?.allowed_age]);

    const genderLabelMap = {
        men: "メンズ",
        women: "レディース",
        unisex: "ユニセックス",
    } as const;
    const ageLabelMap = {
        adult: "大人向け",
        kids: "キッズ向け",
        both: "指定なし",
    } as const;

    const genderLabelOptions = genderOptions.map((g) => genderLabelMap[g]);
    const ageLabelOptions = ageOptions.map((a) => ageLabelMap[a]);
    const selectedGenderLabel = value.gender_type ? genderLabelMap[value.gender_type] : "";
    const selectedAgeLabel = value.age_type ? ageLabelMap[value.age_type] : "";

    useEffect(() => {
        const gender_type = genderOptions.length === 1 ? genderOptions[0] : value.gender_type;
        const age_type = ageOptions.length === 1 ? ageOptions[0] : value.age_type;
        if (gender_type !== value.gender_type || age_type !== value.age_type) onChange({ gender_type, age_type });
    }, [genderOptions, ageOptions, value, onChange]);

    const handleGenderSet = (label: string) => {
        const map: Record<string, GenderAgeValue["gender_type"]> = {
            メンズ: "men",
            レディース: "women",
            ユニセックス: "unisex",
        };

        const gender = map[label];

        if (!gender) {
            toast.error("着用対象（性別）が正しく選択されていません");
            return;
        }

        if (value.gender_type !== gender) {
            onChange({
                ...value,
                gender_type: gender,
            });
        }
    };

    const handleAgeSet = (label: string) => {
        const map: Record<string, GenderAgeValue["age_type"]> = {
            大人向け: "adult",
            キッズ向け: "kids",
            指定なし: "both",
        };

        const age = map[label];

        if (!age) {
            toast.error("着用対象（年齢）が正しく設定されていません。");
            return;
        }

        if (value.age_type !== age) {
            onChange({
                ...value,
                age_type: age,
            });
        }
    };

    return (
        <>
            <div className={styles.twoColumnWrapper}>
                {/* gender_type */}
                <div className={styles.radioSection}>
                    <InputTitle title="着用対象（性別）" hissu />

                    <div className={styles.radioColumn}>
                        {genderLabelOptions.map((g) => (
                            <label key={g} className={styles.radioLabel}>
                                <input
                                    type="radio"
                                    name="gender_type"
                                    value={g}
                                    checked={selectedGenderLabel === g}
                                    onChange={() => handleGenderSet(g)}
                                    className={styles.radio}
                                    required
                                />
                                <p className={styles.radioText}>{g}</p>
                            </label>
                        ))}
                    </div>
                </div>

                {/* age_type */}
                <div className={styles.radioSection}>
                    <InputTitle title="着用対象（年齢）" hissu />

                    <div className={styles.radioColumn}>
                        {ageLabelOptions.map((a) => (
                            <label key={a} className={styles.radioLabel}>
                                <input
                                    type="radio"
                                    name="age_type"
                                    value={a}
                                    checked={selectedAgeLabel === a}
                                    onChange={() => handleAgeSet(a)}
                                    className={styles.radio}
                                    required
                                />
                                <p className={styles.radioText}>{a}</p>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
