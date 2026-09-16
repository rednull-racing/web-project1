import { Metadata } from "next";
import { fetchShopSignupAddressPage } from "../../../../api/address/server";
import { AddressEditForm } from "../../../addressEditForm";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "住所の設定・変更",
        description: "会社所在地を設定・変更できます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchShopSignupAddressPage(id);

    return <AddressEditForm address={data.data} page="shop-signup" shopId={id} />;
}
