import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { fetchItemMetadata, fetchItemPageSeller } from "../../api/server";
import { ItemPage } from "../../itemPage";

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;

    const data = await fetchItemMetadata(id);
    const item = data.item;

    return {
        title: `${item.name} | 出品する商品の確認`,
        description: `「${item.name}」のアップロード確認`,
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session) redirect("/login");

    const data = await fetchItemPageSeller(id, "confirm");
    const item = data.item;

    const userId = String(session?.user?.id).trim();
    const sellerId = String(item.seller_id).trim();

    if (userId !== sellerId) {
        redirect("/");
    }

    return <ItemPage id={id} item={item} page="confirm" sellerMe loggedIn userId={userId || ""} confirmPage="normal" />;
}
