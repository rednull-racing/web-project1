import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { fetchUploadPage } from "../../api/server";
import { Form } from "../../form";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "商品を編集する",
        description: "動画・商品画像・商品名・説明文・価格など、商品情報の変更はこちら！",
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

    const data = await fetchUploadPage(id);

    const item = data.item;

    const userId = String(session?.user.id).trim();
    const sellerId = String(item.seller_id).trim();

    if (userId !== sellerId) {
        redirect("/upload/before");
    }

    if (item.status === "soldout") {
        redirect(`/item/${id}`);
    }

    return (
        <Form
            itemId={id}
            item={item}
            category={data.category}
            allCondition={data.allCondition}
            allDay={data.allDay}
            allService={data.allService}
            allPlace={data.allPlace}
            hasShop={data.hasShop}
            page="edit"
        />
    );
}
