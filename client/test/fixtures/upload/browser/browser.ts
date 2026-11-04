import { test as base, expect, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';
export const api = process.env.UPLOAD_BROWSER_API_URL ?? 'http://127.0.0.1:4041';
export const login = async (context: BrowserContext, baseURL: string) => {
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: 7, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
    const value = await encode({ secret: process.env.UPLOAD_TEST_SECRET ?? 'upload-local-fixture-secret', token: { id: '7', accessToken: token }, maxAge: 3600 });
    await context.addCookies([{ name: 'next-auth.session-token', value, url: baseURL, httpOnly: true }, { name: 'access-token', value: token, url: baseURL }]);
};
export const formData = (id: number, seller: number | string = 7, nullable = false) => ({ itemEditing: { id, seller_id: seller, status: 'normal', name: nullable ? null : 'テストシャツ', detail: null, title: '着用動画', summary: null, price: 1000, before_price: null, image_url: nullable ? [] : ['/no-image(1x1).png'], thumbnail_url: nullable ? null : '/no-image(1x1).png', original_url: nullable ? null : '/test.mp4', converted_url: null, gender_type: 'unisex', age_type: 'both', attributes: { inventory: { current: 1 }, colorVariants: [], materials: [] }, Category: null, Brand: null, ItemConditionOption: null, ShippingDayOption: null, ShippingServiceOption: null, TodouhukenOption: null, shipping_service_free_text: null }, category: [], allCondition: [], allDay: [], allService: [], allPlace: [], hasShop: true });
type Options = {
    status?: number;
    raw?: string;
    disconnect?: boolean;
    seller?: number | string;
    nullable?: boolean;
};
type Fixture = {
    id: number;
    put: (o?: Options) => Promise<void>;
    errors: string[];
};
export const test = base.extend<Fixture>({
    id: async ({}, provide, info) => { await provide(10000 + info.workerIndex * 1000 + [...info.testId].reduce((n, c) => n + c.charCodeAt(0), 0)); },
    put: async ({ request, id }, provide) => { await provide(async (o = {}) => { expect((await request.post(`${api}/__test__/form`, { data: { id, ...o, form: formData(id, o.seller, o.nullable) } })).ok()).toBeTruthy(); }); },
    errors: [async ({ page }, provide) => {
            const errors: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', message => {
                if (message.type() === 'error' && /hydration|did not match|maximum update depth/i.test(message.text()))
                    errors.push(message.text());
            });
            await provide(errors);
        }, { auto: true }],
});
export { expect };
