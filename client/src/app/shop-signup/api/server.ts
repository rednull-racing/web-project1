import { apiFetchServer } from "../../../lib/api/server";
import { BankAccount, ComOrFreeOption, ShopSignup, User } from "../type";

type Signup1Response = {
    user: User;
    shopSignup?: ShopSignup;
    comFree: ComOrFreeOption[];
};

type Signup2Response = {
    account: BankAccount;
};

type SignupResponse = {
    shopSignup: ShopSignup;
};

export const fetchSignup1Page = async (): Promise<Signup1Response> => {
    return apiFetchServer("/shop-signup/1", {
        cache: "no-store",
    });
};

export const fetchSignup2Page = async (shopSignupId: string): Promise<Signup2Response> => {
    return apiFetchServer(`/shop-signup/${shopSignupId}/2`, {
        cache: "no-store",
    });
};

export const fetchSignup3Page = async (shopSignupId: string): Promise<SignupResponse> => {
    return apiFetchServer(`/shop-signup/${shopSignupId}/3`, {
        cache: "no-store",
    });
};

export const fetchSignup5Page = async (shopId: string): Promise<SignupResponse> => {
    return apiFetchServer(`/shop-signup/${shopId}/5`, {
        cache: "no-store",
    });
};
