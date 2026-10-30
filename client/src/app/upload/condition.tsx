"use client";

import { InputTitle } from "@/components/inputForm";
import { useEffect, useState } from "react";
import { ItemConditionOption } from "./types/types";
import styles from "./upload.module.css";

export type ConditionValue = {
    id: string;
    name: string;
};

type Props = {
    allCondition: ItemConditionOption[];
    value: ConditionValue;
    onChange: (v: ConditionValue) => void;
};

export const ConditionInput = ({ allCondition, value, onChange }: Props) => {
    const [openSelect, setOpenSelect] = useState(false);
    const [conditionName, setConditionName] = useState("");

    useEffect(() => {
        if (value.id) {
            setConditionName(value.name);
        }
    }, [value.id, value.name, value]);

    const handleChangeCondition = (con: ItemConditionOption) => {
        setConditionName(con.name);

        if (value.id !== con.id) {
            onChange({
                ...value,
                id: con.id,
                name: con.name,
            });
        }

        setOpenSelect(false);
    };

    return (
        <div className={styles.selectDiv}>
            <InputTitle title="商品の状態" hissu />
            <input
                type="text"
                value={conditionName}
                placeholder="商品の状態を選択"
                onFocus={() => setOpenSelect(true)}
                onBlur={() => setTimeout(() => setOpenSelect(false), 150)}
                className={styles.input}
                readOnly
                required
            />

            {openSelect && (
                <ul className={styles.selectUl}>
                    {allCondition.map((con) => (
                        <li
                            key={con.id}
                            onMouseDown={() => handleChangeCondition(con)}
                            data-selected={conditionName === con.name}
                            className={styles.selectLi}
                        >
                            {con.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
