import { apiFetch, apiFetchNoToken } from "../../../lib/api/client";

type AccountBody = {
    bankName: string;
    branch: string;
    accountType: string;
    accountNumber: string;
    meigi: string;
};

type BankSuggestion = {
    name: string;
    code: string;
    kana: string;
    hira: string;
    normalize: string;
};

type BranchSuggestion = {
    name: string;
    code: string;
    kana: string;
    hira: string;
};

type SuggestBanksResponse = {
    banks: BankSuggestion[];
};

type SuggestBranchesResponse = {
    branches: BranchSuggestion[];
};

export const fetchSuggestBanks = async (bankQuery: string): Promise<SuggestBanksResponse> => {
    return apiFetchNoToken(`/banks/search?keyword=${bankQuery}`, {
        method: "GET",
    });
};

export const fetchSuggestBranches = async (branchQuery: string, bankCode: string): Promise<SuggestBranchesResponse> => {
    return apiFetchNoToken(`/branches/search?keyword=${branchQuery}&bankCode=${bankCode}`, {
        method: "GET",
    });
};

export const fetchStep2 = async (shopSignupId: string, body: AccountBody) => {
    return apiFetch(`/shop-signup/${shopSignupId}/bank-account`, {
        method: "POST",
        body: JSON.stringify(body),
    });
};
