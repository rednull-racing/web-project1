import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { fetchUploadPage } from "../api/server";
import { Form } from "../form";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "商品を出品する",
        description: "商品の出品はこちら！",
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

    const userId = String(session?.user.id).trim();
    const sellerId = String(data.itemEditing.seller_id).trim();

    if (userId !== sellerId) {
        redirect("/upload/before");
    }

    return (
        <Form
            itemEditingId={id}
            itemEditing={data.itemEditing}
            category={data.category}
            allCondition={data.allCondition}
            allDay={data.allDay}
            allService={data.allService}
            allPlace={data.allPlace}
            hasShop={data.hasShop}
            page="normal"
        />
    );
}
