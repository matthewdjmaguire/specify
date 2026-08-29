import path from "node:path";

export const USER_AUTH_FILE = path.join(__dirname, ".auth/user.json");
export const ADMIN_AUTH_FILE = path.join(__dirname, ".auth/admin.json");
export const USER_CONTEXT_FILE = path.join(__dirname, ".auth/user-context.json");

export type UserContext = { smallThemeId: string };
