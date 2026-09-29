import { getAccessToken } from "../getAccessToken";
import { ApiError } from "./apiError";

type FetchOptions = RequestInit & {
    token?: string;
};

export const apiFetch = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const accessToken = await getAccessToken();

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

export const apiFetchFile = async (path: string): Promise<Blob> => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        throw new ApiError("UNAUTHORIZED");
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new ApiError(data?.code ?? "API_ERROR");
    }

    return res.blob();
};
