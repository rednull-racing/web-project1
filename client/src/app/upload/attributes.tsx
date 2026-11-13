"use client";

import { InputTitle } from "@/components/inputForm";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo } from "react";
import styles from "./attributesCard.module.css";
import CStyles from "./upload.module.css";

export type AttributesValue = {
    all_inventory: number;
    colorVariants: Array<{
        _uiId: string;
        color: string | null;
        inventory: number;
        image: File | null;
        image_uploaded: boolean;
        sizes: {
            size: string | null;
            inventory: number;
        }[];
    }>;
};

type Props = {
    value: AttributesValue;
    onChange: (v: AttributesValue) => void;
    imageUrlMap: Map<string, string>;
};

export const AttributesInput = ({ value, onChange, imageUrlMap }: Props) => {
    const previewMap = useMemo(() => {
        const map = new Map<string, string>();

        value.colorVariants.forEach((variant) => {
            if (variant.image) {
                map.set(variant._uiId, URL.createObjectURL(variant.image));
            }
        });

        return map;
    }, [value.colorVariants]);

    useEffect(() => {
        return () => {
            previewMap.forEach((url) => {
                URL.revokeObjectURL(url);
            });
        };
    }, [previewMap]);

    const handleAllInventory = (num: number) => {
        const safeNum = Math.max(1, num);

        onChange({
            ...value,
            all_inventory: safeNum,
        });

        if (safeNum > 1 && value.colorVariants.length === 0) {
            onChange({
                ...value,
                all_inventory: safeNum,
                colorVariants: [createEmptyVariant()],
            });
        }

        if (safeNum === 1) {
            onChange({
                ...value,
                all_inventory: safeNum,
                colorVariants: [],
            });
        }
    };

    const createEmptyVariant = () => ({
        _uiId: crypto.randomUUID(),
        color: null,
        inventory: 1,
        image: null,
        image_uploaded: true,
        sizes: [],
    });

    const createEmptySize = () => ({
        size: "",
        inventory: 1,
    });

    const handleChangeCardImage = (file: File, uiId: string) => {
        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) =>
                v._uiId === uiId ? { ...v, image: file, image_uploaded: false } : v,
            ),
        });
    };

    const handleChangeVariantColor = (uiId: string, color: string) => {
        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) => (v._uiId === uiId ? { ...v, color } : v)),
        });
    };

    const handleChangeSize = (colorVariantsId: string, newSize: string, index: number) => {
        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) =>
                v._uiId === colorVariantsId
                    ? {
                          ...v,
                          sizes: v.sizes.map((s, i) => (i === index ? { ...s, size: newSize } : s)),
                      }
                    : v,
            ),
        });
    };

    const handleChangeColorInventory = (uiId: string, newInventory: number) => {
        const safeNum = Math.max(1, newInventory);

        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) => (v._uiId === uiId ? { ...v, inventory: safeNum } : v)),
        });
    };

    const handleChangeSizeInventory = (colorVariantsId: string, newInventory: number, index: number) => {
        const safeNum = Math.max(1, newInventory);

        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) =>
                v._uiId === colorVariantsId
                    ? {
                          ...v,
                          sizes: v.sizes.map((s, i) => (i === index ? { ...s, inventory: safeNum } : s)),
                      }
                    : v,
            ),
        });
    };

    const cardRemove = (uiId: string) => {
        const nextVariants = value.colorVariants.filter((v) => v._uiId !== uiId);

        onChange({
            ...value,
            colorVariants: nextVariants,
        });

        if (nextVariants.length === 0) {
            // Variants are hidden automatically when the last one is removed.
        }
    };

    const addVariant = () => {
        if (value.colorVariants.length >= value.all_inventory) return;

        onChange({
            ...value,
            colorVariants: [...value.colorVariants, createEmptyVariant()],
        });
    };

    const addSize = (colorVariantId: string) => {
        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) =>
                v._uiId === colorVariantId
                    ? {
                          ...v,
                          sizes: [...v.sizes, createEmptySize()],
                      }
                    : v,
            ),
        });
    };

    const removeSize = (colorVariantsId: string, index: number) => {
        onChange({
            ...value,
            colorVariants: value.colorVariants.map((v) =>
                v._uiId === colorVariantsId
                    ? {
                          ...v,
                          sizes: v.sizes.filter((_, i) => i !== index),
                      }
                    : v,
            ),
        });
    };

    return (
        <>
            <div className={CStyles.inputDiv}>
                <InputTitle title="出品点数" hissu />
                <input
                    type="number"
                    min={1}
                    step={1}
                    value={value.all_inventory}
                    onChange={(e) => handleAllInventory(Number(e.target.value))}
                    placeholder="1"
                    className={CStyles.input}
                />
            </div>

            {value.colorVariants.length > 0 && (
                <div className={styles.cardWrapper}>
                    {value.colorVariants.map((variant) => {
                        const previewUrl = previewMap.get(variant._uiId) ?? imageUrlMap.get(variant._uiId) ?? null;

                        return (
                            <div className={styles.variantsCard} key={variant._uiId}>
                                <X className={styles.cardX} onClick={() => cardRemove(variant._uiId)} />

                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleChangeCardImage(file, variant._uiId);
                                        e.currentTarget.value = "";
                                    }}
                                    placeholder="画像をアップロード"
                                    className={styles.cardImageInput}
                                    required
                                />

                                <Image
                                    src={previewUrl ?? ""}
                                    alt="attributes_preview"
                                    width={80}
                                    height={80}
                                    className={styles.cardPreview}
                                />

                                <div className={styles.cardInputRow}>
                                    <div className={styles.colorInputDiv}>
                                        <p className={styles.cardInputTitle}>カラー</p>
                                        <input
                                            type="text"
                                            value={variant.color ?? ""}
                                            onChange={(e) => handleChangeVariantColor(variant._uiId, e.target.value)}
                                            placeholder="カラーを入力してください"
                                            className={styles.colorInput}
                                        />
                                    </div>

                                    <div className={styles.colorInventoryInputDiv}>
                                        <p className={styles.cardInputTitle}>在庫数</p>
                                        <input
                                            type="number"
                                            value={variant.inventory ?? 1}
                                            onChange={(e) =>
                                                handleChangeColorInventory(variant._uiId, Number(e.target.value))
                                            }
                                            min={1}
                                            placeholder="1"
                                            className={styles.colorInventoryInput}
                                        />
                                    </div>
                                </div>

                                {/* サイズ　*/}
                                <div className={styles.sizeList}>
                                    {variant.sizes.map((s, index) => (
                                        <div className={styles.sizeRow} key={index}>
                                            <div className={styles.sizeInputDiv}>
                                                <p className={styles.sizeInputTitle}>サイズ</p>
                                                <input
                                                    type="text"
                                                    value={s.size ?? ""}
                                                    onChange={(e) =>
                                                        handleChangeSize(variant._uiId, e.target.value, index)
                                                    }
                                                    placeholder="S"
                                                    className={styles.sizeInput}
                                                />
                                            </div>

                                            <div className={styles.sizeInventoryInputDiv}>
                                                <p className={styles.sizeInputTitle}>在庫数</p>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={s.inventory}
                                                    onChange={(e) =>
                                                        handleChangeSizeInventory(
                                                            variant._uiId,
                                                            Number(e.target.value),
                                                            index,
                                                        )
                                                    }
                                                    placeholder="1"
                                                    className={styles.sizeInventoryInput}
                                                />
                                            </div>

                                            <FontAwesomeIcon
                                                icon={faTrash}
                                                className={styles.sizeDelete}
                                                onClick={() => removeSize(variant._uiId, index)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    className={styles.addSizeButton}
                                    onClick={() => addSize(variant._uiId)}
                                >
                                    + サイズ追加
                                </button>
                            </div>
                        );
                    })}

                    {/* +カード */}
                    <div className={styles.addCard} onClick={addVariant}>
                        <span className={styles.addIcon}>+</span>
                        <p className={styles.addText}>追加する</p>
                    </div>
                </div>
            )}
        </>
    );
};
