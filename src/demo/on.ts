/**
 * Demo switch -- the DEMO version. Only reachable when metro.config.js
 * swaps it in for "@/demo/mode" (SSJ_DEMO=1).
 */
import { DEMO_ANON_KEY, DEMO_URL, demoFetch } from "./backend";

export const isDemo: boolean = true;
export { DEMO_ANON_KEY, DEMO_URL, demoFetch };

// Fails the typecheck if this module ever drifts from the production one.
const _sameShape: typeof import("./mode") = { isDemo, demoFetch, DEMO_URL, DEMO_ANON_KEY };
void _sameShape;
