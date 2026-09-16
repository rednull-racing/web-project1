import { Metadata } from "next";
import { fetchShopSignupConNamePage } from "../../../../../api/name/server";
import { NameEditForm } from "../../../../nameEditForm";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "氏名の設定・変更",
        description: "配送情報に記載する氏名の変更ができます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchShopSignupConNamePage(id);

    return <NameEditForm name={data.name} page="con-shop-signup" shopId={id} />;
}
