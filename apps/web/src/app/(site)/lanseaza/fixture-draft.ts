import type { ProjectFields } from "@/lib/schemas/project";

/**
 * Design fixtures only: what screen 09's reference shows in the form, word for
 * word, for `ioana-muresan` (fixtures.json → screenStates["09"]). It isn't Tuns
 * la Fix's stored row: the reference's description is shorter and its tools
 * differ. The screenshots are the fixtures' placeholders.
 */
export const FIXTURE_DRAFT: ProjectFields = {
  challengeSlug: "frizerie",
  name: "Tuns la Fix",
  pitch: "Programări online pentru frizeria din cartier, fără telefoane.",
  liveUrl: "https://tunslafix.example",
  screenshots: [
    "/dev/captura/tuns-la-fix-1.svg",
    "/dev/captura/tuns-la-fix-2.svg",
  ],
  description:
    "Tuns la Fix e o pagină de programări pentru frizeria lui Nea Gică. Alegi tunsoarea, vezi orele libere și confirmi cu numele și telefonul. Nu îți faci cont.",
  // In the order picked: the preview shows "Next.js", "Claude".
  tools: ["Next.js", "Claude", "Supabase"],
  duration: "10_30h",
  hardestPart: "Să nu se suprapună două programări la aceeași oră.",
  prompt:
    "Ești frizer, nu programator. Spune-mi ce ai vrea să vezi dimineața când deschizi pagina cu programările.",
  stage: "launched",
  update: "",
};

export const FIXTURE_DRAFT_VIEWER = "ioana-muresan";
