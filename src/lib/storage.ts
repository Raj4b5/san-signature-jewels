import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * The web build is pre-rendered in Node (app.json sets web.output to
 * "static", which is what gives the site real HTML for search engines
 * and link previews). There is no `window` there, and AsyncStorage on
 * web is a localStorage wrapper -- touching it during pre-render throws
 * "window is not defined" and fails the build.
 *
 * So: a real store in the browser and on device, a throwaway in-memory
 * one while pre-rendering. Nothing persisted server-side is ever read
 * back, which is correct -- the server has no user.
 */
const isPrerender = Platform.OS === "web" && typeof window === "undefined";

const memory = new Map<string, string>();

const memoryStorage = {
  getItem: async (key: string) => memory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    memory.delete(key);
  },
};

export const storage = isPrerender ? memoryStorage : AsyncStorage;
export const isPrerendering = isPrerender;
