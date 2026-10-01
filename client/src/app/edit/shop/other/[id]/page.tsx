import { Metadata } from "next";
import { fetchOtherPage } from "../../../api/shop/shopInfo/server";
import { ShopOtherEditForm } from "../shopOtherEditForm";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "その他ショップ情報の設定・変更",
        description: "その他のショップ情報を設定・変更できます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchOtherPage(id);

    <ShopOtherEditForm shop={data.shop} shopId={id} />
}
