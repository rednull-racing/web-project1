import { getAccessToken } from "../getAccessToken";
import { ApiError } from "./apiError";

type FetchOptions = RequestInit & {
    token?: string;
};

export const apiFetch = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    console.log("① apiFetch start", path);
    const accessToken = await getAccessToken();

    console.log("② token取得完了", accessToken);

    if (!accessToken) {
        throw new ApiError("UNAUTHORIZED");
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    console.log("③ fetch完了", res.status);

    const data = await res.json();

    if (!res.ok) {
        throw new ApiError(data.code ?? "API Error");
    }

    return data;
};

export const apiFetchNoAuth = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const accessToken = await getAccessToken();

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        ...options,
        headers: {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        throw new ApiError(data.code ?? "API Error");
    }

    return data;
};

export const apiFetchNoToken = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        throw new ApiError(data.code ?? "API Error");
    }

    return data;
};
