"use client";

import { InputTitle, Textarea } from "@/components/inputForm";
import { useEffect, useState } from "react";
import { ShippingDayOption, ShippingServiceOption, TodouhukenOption } from "./types/types";
import styles from "./upload.module.css";

export type ShippingValue = {
    day_id: string | null;
    day_name: string | null;
    service_id: string | null;
    service_name: string | null;
    place_id: string | null;
    place_name: string | null;
    free_text: string | null;
};

type Props = {
    allDay: ShippingDayOption[];
    allService: ShippingServiceOption[];
    allPlace: TodouhukenOption[];
    value: ShippingValue;
    onChange: (v: ShippingValue) => void;
};

export const ShippingInput = ({ allDay, allService, allPlace, value, onChange }: Props) => {
    const [openServiceSelect, setOpenServiceSelect] = useState(false);
    const [openPlaceSelect, setOpenPlaceSelect] = useState(false);
    const [selectDayText, setSelectDayText] = useState("");
    const [selectServiceText, setSelectServiceText] = useState("");
    const [selectPlaceText, setSelectPlaceText] = useState("");

    useEffect(() => {
        if (value.day_id) {
            setSelectDayText(value.day_name ?? "");
        }

        if (value.service_id) {
            setSelectServiceText(value.service_name ?? "");
        }

        if (value.place_id) {
            setSelectPlaceText(value.place_name ?? "");
        }
    }, [value.day_id, value.day_name, value.service_id, value.service_name, value.place_id, value.place_name]);

    const handleChangeDay = (day: ShippingDayOption) => {
        setSelectDayText(day.name);

        if (value.day_id !== day.id) {
            onChange({
                ...value,
                day_id: day.id,
                day_name: day.name,
            });
        }
    };

    const handleChangeService = (service: ShippingServiceOption) => {
        setSelectServiceText(service.name);

        if (value.service_id !== service.id) {
            onChange({
                ...value,
                service_id: service.id,
                service_name: service.name,
            });
        }
    };

    const handleChangePlace = (place: TodouhukenOption) => {
        setSelectPlaceText(place.name);

        if (value.place_id !== place.id) {
            onChange({
                ...value,
                place_id: place.id,
                place_name: place.name,
            });
        }
    };

    const handleChangeFree = (val: string) => {
        onChange({
            ...value,
            free_text: val,
        });
    };

    return (
        <>
            {/* day */}
            <div className={styles.radioSection}>
                <InputTitle title="発送までの日数" hissu />

                <div className={styles.radioColumn}>
                    {allDay.map((day) => (
                        <label key={day.id} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="day_option"
                                value={day.name}
                                checked={selectDayText === day.name}
                                onChange={() => handleChangeDay(day)}
                                className={styles.radio}
                                required
                            />
                            <p className={styles.radioText}>{day.name}</p>
                        </label>
                    ))}
                </div>
            </div>

            <div className={styles.twoColumnWrapper}>
                {/* service */}
                <div className={styles.selectColumn}>
                    <InputTitle title="配送方法" hissu />
                    <input
                        type="text"
                        value={selectServiceText}
                        placeholder="配送方法を選択"
                        onFocus={() => setOpenServiceSelect(true)}
                        onBlur={() => setTimeout(() => setOpenServiceSelect(false), 150)}
                        className={styles.input}
                        readOnly
                        required
                    />

                    {openServiceSelect && (
                        <ul className={styles.selectUl}>
                            {allService.map((service) => (
                                <li
                                    key={service.id}
                                    onMouseDown={() => handleChangeService(service)}
                                    data-selected={selectServiceText === service.name}
                                    className={styles.selectLi}
                                >
                                    {service.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* place */}
                <div className={styles.selectColumn}>
                    <InputTitle title="発送元地域" hissu />
                    <input
                        type="text"
                        value={selectPlaceText}
                        placeholder="発送元地域を選択"
                        onFocus={() => setOpenPlaceSelect(true)}
                        onBlur={() => setTimeout(() => setOpenPlaceSelect(false), 150)}
                        className={styles.input}
                        readOnly
                        required
                    />

                    {openPlaceSelect && (
                        <ul className={styles.selectUl}>
                            {allPlace.map((t) => (
                                <li
                                    key={t.id}
                                    onMouseDown={() => handleChangePlace(t)}
                                    data-selected={selectPlaceText === t.name}
                                    className={styles.selectLi}
                                >
                                    {t.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* free_text */}
            <Textarea
                title="配送に関する備考（自由入力）"
                value={value.free_text ?? ""}
                onChange={handleChangeFree}
                maxLength={500}
                placeholder="配送方法や梱包、開封方法、対応可能時間など自由入力"
            />
        </>
    );
};
