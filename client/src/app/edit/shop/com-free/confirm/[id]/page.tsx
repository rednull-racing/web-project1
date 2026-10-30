import { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchComFreeConfirmPage } from "../../../../api/shop/shopEdit/server";
import { Client } from "../client";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "事業者情報の確認・変更",
        description: "事業形態を変更に伴う事業者情報の変更ができます。（事業形態の変更には審査が必要になります。）",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchComFreeConfirmPage(id);

    const shopEdit = data.shopEdit;

    if (!shopEdit.ShopInfo) notFound();

    return (
        <Client shopId={shopEdit.ShopInfo.id} shopInfo={shopEdit.ShopInfo} shopEditId={id} shopInfoEdit={shopEdit} />
    );
}
