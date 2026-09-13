/**
 * Demo switch -- the PRODUCTION version of this module.
 *
 * `npm run demo` and `npm run build:demo` set SSJ_DEMO=1, and metro.config.js
 * then resolves "@/demo/mode" to ./on.ts instead of this file. Every other
 * build resolves it here, so a real app or website never contains the fake
 * backend, the sample catalogue, or the placeholder photos.
 */
export const isDemo: boolean = false;
export const demoFetch: typeof fetch | undefined = undefined;
export const DEMO_URL: string = "";
export const DEMO_ANON_KEY: string = "";
