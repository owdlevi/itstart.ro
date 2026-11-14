import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/core";

export const { GET, POST } = toNextJsHandler(auth);
