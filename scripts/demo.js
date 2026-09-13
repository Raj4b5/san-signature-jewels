#!/usr/bin/env node
/**
 * npm run demo
 *
 * Starts the app with a built-in sample shop -- no Supabase, Razorpay or
 * any account needed. Press `w` for the browser, or scan the QR code with
 * Expo Go on a phone on the same Wi-Fi. Extra flags pass through, e.g.
 *   npm run demo -- --tunnel     (phone on a different network)
 */
const { spawn } = require("node:child_process");

// One command string rather than an argument array: Node warns about
// arrays combined with `shell`, and the shell is needed for `npx` on Windows.
const quote = (arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);
const command = ["npx expo start --clear", ...process.argv.slice(2).map(quote)].join(" ");

const child = spawn(command, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SSJ_DEMO: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
