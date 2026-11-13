import { getToken } from "next-auth/jwt";
import type { GetTokenParams } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getValidAccessToken } from "../refreshToken";

type FetchOptions = RequestInit & {
    token?: string;
};

export const apiFetchServer = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const cookieStore = await cookies();
    const headerStore = await headers();

    const token = await getToken({
        req: {
            headers: Object.fromEntries(headerStore.entries()),
            cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
        } as GetTokenParams["req"],
        secret: process.env.NEXTAUTH_SECRET!,
    });

    if (!token) {
        redirect("/login");
    }

    const accessToken = await getValidAccessToken(token);

    if (!accessToken) redirect("/login");

    const res = await fetch(`${process.env.API_URL}${path}`, {
        ...options,
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(data.code);
        if (res.status === 401) redirect("/login");
        if (res.status === 404) notFound();
        throw new Error(data.code ?? "SERVER_ERROR");
    }

    return data;
};

export const apiFetchServerNoAuth = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access-token")?.value;

    const res = await fetch(`${process.env.API_URL}${path}`, {
        ...options,
        method: "GET",
        headers: {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(data.code);
        if (res.status === 404) notFound();
        throw new Error(data.code ?? "SERVER_ERROR");
    }

    return data;
};

export const apiFetchServerNoToken = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const res = await fetch(`${process.env.API_URL}${path}`, {
        ...options,
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(data.code);
        if (res.status === 404) notFound();
        throw new Error(data.code ?? "SERVER_ERROR");
    }

    return data;
};

export const apiFetchServerNoAuthPatch = async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access-token")?.value;

    const res = await fetch(`${process.env.API_URL}${path}`, {
        ...options,
        method: "PATCH",
        headers: {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(data.code);
    }

    return data;
};
