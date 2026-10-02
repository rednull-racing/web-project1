/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "flexoutdoor.s3.ap-northeast-1.amazonaws.com",
                pathname: "/**",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "5000",
                pathname: "/api/**",
            },
        ],
        dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    },

    typescript: {
        ignoreBuildErrors: true,
    },

    turbopack: {},
};

export default nextConfig;
