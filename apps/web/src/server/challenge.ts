import "server-only";
import { cache } from "react";
import { core } from "./core";

/** The running challenge, read once per request (the header and the page both need it). */
export const getRunningChallenge = cache(() => core.challenges.running());
