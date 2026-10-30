import { Metadata } from "next";
import { cookies } from "next/headers";
import { SITE } from "../../config/site";
import { fetchInquiryPage } from "./api/server";
import { Form } from "./form";
import InquiryUI from "./inquiryUI";
import { LinkElement } from "./linkElement";
import { User } from "./types";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "お問い合わせ",
        description: `${SITE.appName}のご利用に関することや取引に関すること、お困りごとなどお気軽にお問い合わせください。（お問い合わせの返答可能時間：${SITE.contactTime}）`,
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access-token")?.value;

    let user: User | undefined = undefined;

    if (accessToken) {
        const data = await fetchInquiryPage();
        user = data.user;
    }

    return (
        <InquiryUI title="お問い合わせ">
            <LinkElement />
            <Form user={user} />
        </InquiryUI>
    );
}
