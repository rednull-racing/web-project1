import { Inquiry } from "../../models/index.js";

type CreateInquiryParams = {
    data: {
        user_id: number | null;
        name: string;
        email: string;
        title: string;
        body: string;
    };
};

export const createInquiry = async ({ data }: CreateInquiryParams) => {
    await Inquiry.create(data);
};
