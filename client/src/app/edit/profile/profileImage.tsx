"use client";

import { InputTitle } from "@/components/inputForm";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import styles from "../edit.module.css";
import { User } from "../types";

type Props = {
    user: User;
    setFile: (file: File | null) => void;
    defaultImage: boolean;
    setDefaultImage: (value: boolean) => void;
};

export const ProfileImage = ({ user, setFile, defaultImage, setDefaultImage }: Props) => {
    const originalImage = user.profile_image || "/default-profile.png";
    const [preview, setPreview] = useState<string>(user.profile_image || "/default-profile.png");

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    });

    const handleDefaultImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setDefaultImage(checked);

        if (checked) {
            setPreview("/default-profile.png");
            setFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } else {
            setPreview(originalImage);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setDefaultImage(false);
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    return (
        <div className={styles.imageInputDiv}>
            <InputTitle title="プロフィール画像" />
            <input
                type="file"
                accept="image/*"
                onChange={handleChange}
                className={styles.imageInput}
                placeholder="プロフィール画像をアップロード"
                ref={fileInputRef}
            />
            <Image
                src={defaultImage ? "/default-profile.png" : preview || "/default-profile.png"}
                alt="プロフィール画像プレビュー"
                width={90}
                height={90}
                className={styles.previewProfile}
            />
            <label className={styles.checkLabel}>
                <input
                    type="checkbox"
                    name="defaultCheck"
                    checked={defaultImage}
                    onChange={handleDefaultImage}
                    className={styles.check}
                />
                <p className={styles.checkText}>デフォルトに戻す</p>
            </label>
        </div>
    );
};
