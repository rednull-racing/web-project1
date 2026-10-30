import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { fetchItemConfirmPage, fetchItemConfirmPageMetadata } from "../../api/server";
import { ItemConfirmPage } from "../../itemConfirmPage";

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const data = await fetchItemConfirmPageMetadata(id);
    const name = data.itemEditing.name || "商品名未入力";

    return {
        title: `${name} | 更新する商品の確認`,
        description: `「${name}」の更新内容確認`,
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

    const data = await fetchItemConfirmPage(id);

    const userId = String(session?.user?.id).trim();
    const sellerId = String(data.itemEditing.seller_id).trim();

    if (userId !== sellerId) {
        redirect("/");
    }

    return <ItemConfirmPage id={id} itemEditing={data.itemEditing} page="edit" />;
}
