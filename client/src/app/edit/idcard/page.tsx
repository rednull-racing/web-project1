import { Metadata } from "next";
import { IdCardEditForm } from "./idEditForm";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "身分証の設定・変更",
        description: "身分証を設定・変更できます。身分証を更新した際はこちらから画像をアップロードしてください。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return <IdCardEditForm />;
}
