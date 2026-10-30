"use client";

import { Button, InputStr, Textarea } from "@/components/inputForm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchProfileEdit } from "../api/profile/client";
import EditUI from "../editUI";
import { User } from "../types";
import { ProfileImage } from "./profileImage";

type Props = {
    user: User;
};

export const ProfileEditForm = ({ user }: Props) => {
    const [file, setFile] = useState<File | null>(null);
    const [userNameValue, setUserNameValue] = useState(user.user_name);
    const [introductionValue, setIntroductionValue] = useState(user.user_introduction ?? null);
    const [defaultImage, setDefaultImage] = useState(false);
    const router = useRouter();

    const submit = async () => {
        if (!userNameValue) {
            toast.error("必須項目が空になっていま。");
            return;
        }

        const query = file || defaultImage ? "?imageEdit=true" : "";

        const body = {
            fileName: file?.name,
            contentType: file?.type,
            userName: userNameValue,
            introduction: introductionValue,
        };

        try {
            const data = await fetchProfileEdit(query, body);

            if (file && data.signedUrl) {
                const uploadRes = await fetch(data.signedUrl, {
                    method: "PUT",
                    headers: {
                        "Content-Type": file.type,
                    },
                    body: file,
                });

                if (!uploadRes.ok) {
                    toast.error("プロフィール画像のS3アップロードに失敗しました");
                    return;
                }
            }

            toast.success("プロフィールを変更しました");
            await sleep(1500);

            router.push(`/profile/${user.id}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("プロフィールの変更に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください。");
        }
    };

    return (
        <EditUI title="プロフィール設定">
            <ProfileImage user={user} setFile={setFile} defaultImage={defaultImage} setDefaultImage={setDefaultImage} />
            <InputStr
                title="ユーザーネーム"
                type="text"
                value={userNameValue}
                onChange={setUserNameValue}
                placeholder="ユーザーネーム"
                hissu
            />
            <Textarea
                title="自己紹介"
                value={introductionValue}
                onChange={setIntroductionValue}
                placeholder="年齢・地域・趣味・欲しい物など（300文字以内）"
                maxLength={300}
            />
            <Button onClick={submit}>変更する</Button>
        </EditUI>
    );
};
