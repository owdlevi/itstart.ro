import { describe, expect, test } from "vitest";
import { createTestDb } from "@repo/db/testing";
import { createProjects } from "../projects";
import {
  addExtra,
  makeChallenge,
  makeProject,
  makeUser,
  review,
  vote,
} from "../test-data";
import {
  createRecognitions,
  RECOGNITION_REASON_MAX,
  type RecognitionEntry,
  type RecognitionKind,
} from "./index";

// The default test challenge ends on 30 November 2026, 23:59 in Bucharest.
const AFTER = new Date("2026-12-02T10:00:00Z");
const BEFORE = new Date("2026-11-20T10:00:00Z");
const LAUNCH = new Date("2026-11-10T10:00:00Z");

async function setup(at = AFTER) {
  const db = await createTestDb();
  const now = () => at;
  const recognitions = createRecognitions({
    db,
    now,
    projects: createProjects({ db, now }),
  });
  const admin = await makeUser(db, { role: "admin" });
  const challenge = await makeChallenge(db);
  const launch = async (
    fields: Partial<Parameters<typeof makeProject>[1]> = {},
    owner?: { id: string },
  ) =>
    makeProject(db, {
      ownerId: owner?.id ?? (await makeUser(db)).id,
      challengeId: challenge.id,
      launchedAt: LAUNCH,
      ...fields,
    });
  return { db, recognitions, admin, challenge, launch };
}

const none: Record<RecognitionKind, RecognitionEntry | null> = {
  community: null,
  jury: null,
  first_project: null,
};

describe("recognitions.save", () => {
  test("enters the three recognitions for an ended challenge, and replaces them", async () => {
    const { recognitions, admin, challenge, launch } = await setup();
    const [a, b, c] = [await launch(), await launch(), await launch()];

    const first = await recognitions.save(admin.id, challenge.slug, {
      community: {
        projectId: a.id,
        reason: "  Cele mai multe   voturi: 112. ",
      },
      jury: { projectId: b.id, reason: "Se înțelege din prima." },
      first_project: { projectId: c.id, reason: "Primul ei proiect." },
    });
    expect(first).toEqual({ ok: true });
    const map = await recognitions.of([a.id, b.id, c.id]);
    expect([...map.values()]).toEqual(
      expect.arrayContaining(["community", "jury", "first_project"]),
    );

    await recognitions.save(admin.id, challenge.slug, {
      ...none,
      jury: { projectId: a.id, reason: "Alt motiv." },
    });
    const editor = await recognitions.editor(admin.id, challenge.slug);
    if (!editor.ok) throw new Error(editor.reason);
    expect(editor.value.current).toEqual({
      ...none,
      jury: { projectId: a.id, reason: "Alt motiv." },
    });
  });

  test("refuses anyone but an admin", async () => {
    const { db, recognitions, challenge } = await setup();
    const member = await makeUser(db);

    expect(await recognitions.save(member.id, challenge.slug, none)).toEqual({
      ok: false,
      reason: "not_admin",
    });
    expect(await recognitions.editor(member.id, challenge.slug)).toEqual({
      ok: false,
      reason: "not_admin",
    });
  });

  test("refuses recognitions before the deadline: the votes aren't final (rule 3)", async () => {
    const { recognitions, admin, challenge, launch } = await setup(BEFORE);
    const project = await launch();

    const result = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      jury: { projectId: project.id, reason: "Bun." },
    });

    expect(result).toEqual({ ok: false, reason: "not_ended" });
  });

  test("refuses a late launch (rule 7)", async () => {
    const { recognitions, admin, challenge, launch } = await setup();
    const late = await launch({ isLate: true });

    const result = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      jury: { projectId: late.id, reason: "Bun." },
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      kind: "jury",
      problem: "not_eligible",
    });
  });

  test("refuses an agent's project (rule 20)", async () => {
    const { db, recognitions, admin, challenge, launch } = await setup();
    const agent = await makeUser(db, { isAgent: true });
    const project = await launch({}, agent);

    const result = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      community: { projectId: project.id, reason: "Multe voturi." },
    });

    expect(result).toMatchObject({
      kind: "community",
      problem: "not_eligible",
    });
  });

  test("refuses a project in progress or from another challenge", async () => {
    const { db, recognitions, admin, challenge, launch } = await setup();
    const wip = await launch({ stage: "in_progress", launchedAt: null });
    const elsewhere = await makeProject(db, {
      ownerId: (await makeUser(db)).id,
      challengeId: (await makeChallenge(db)).id,
      launchedAt: LAUNCH,
    });

    for (const project of [wip, elsewhere]) {
      const result = await recognitions.save(admin.id, challenge.slug, {
        ...none,
        jury: { projectId: project.id, reason: "Bun." },
      });
      expect(result).toMatchObject({ problem: "not_eligible" });
    }
  });

  test("gives the first project only to a builder's first launch ever", async () => {
    const { db, recognitions, admin, challenge, launch } = await setup();
    const veteran = await makeUser(db);
    await makeProject(db, {
      ownerId: veteran.id,
      launchedAt: new Date("2026-09-01T10:00:00Z"),
    });
    const second = await launch({}, veteran);
    const newcomer = await launch();

    const refused = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      first_project: { projectId: second.id, reason: "Primul." },
    });
    const accepted = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      first_project: { projectId: newcomer.id, reason: "Primul." },
    });

    expect(refused).toMatchObject({ problem: "not_first_project" });
    expect(accepted).toEqual({ ok: true });
  });

  test("refuses one project in two recognitions", async () => {
    const { recognitions, admin, challenge, launch } = await setup();
    const project = await launch();

    const result = await recognitions.save(admin.id, challenge.slug, {
      ...none,
      community: { projectId: project.id, reason: "Voturi." },
      jury: { projectId: project.id, reason: "Juriu." },
    });

    expect(result).toMatchObject({ kind: "jury", problem: "duplicate" });
  });

  test("refuses an empty or too long reason", async () => {
    const { recognitions, admin, challenge, launch } = await setup();
    const project = await launch();
    const save = (reason: string) =>
      recognitions.save(admin.id, challenge.slug, {
        ...none,
        jury: { projectId: project.id, reason },
      });

    expect(await save("   ")).toMatchObject({ problem: "reason_empty" });
    expect(await save("a".repeat(RECOGNITION_REASON_MAX + 1))).toMatchObject({
      problem: "reason_too_long",
    });
  });
});

describe("recognitions.editor", () => {
  test("lists people's on-time launches and suggests the most voted for the community (rules 7 and 20)", async () => {
    const { db, recognitions, admin, challenge, launch } = await setup();
    const early = await launch({ name: "Devreme" });
    const later = await launch({
      name: "Târziu",
      launchedAt: new Date("2026-11-20T10:00:00Z"),
    });
    const fewer = await launch({ name: "Mai puține" });
    const late = await launch({ name: "După termen", isLate: true });
    const agentProject = await launch(
      { name: "Agent" },
      await makeUser(db, { isAgent: true }),
    );
    await vote(db, later.id, 3);
    await vote(db, early.id, 2);
    await addExtra(db, early.id, "votes", 1);
    await vote(db, fewer.id, 1);
    await vote(db, late.id, 9);
    await vote(db, agentProject.id, 9);

    const editor = await recognitions.editor(admin.id, challenge.slug);
    if (!editor.ok) throw new Error(editor.reason);

    expect(editor.value.candidates.map((c) => [c.name, c.votes])).toEqual([
      ["Devreme", 3],
      ["Târziu", 3],
      ["Mai puține", 1],
    ]);
    // A tie goes to the earlier launch.
    expect(editor.value.suggestedCommunity).toBe(early.id);
    expect(editor.value.challenge.ended).toBe(true);
  });
});

describe("recognitions.results", () => {
  test("shows the recognitions, the best agent apart and the other launches, no agent ranked (rule 20)", async () => {
    const { db, recognitions, admin, challenge, launch } = await setup();
    const agent = await makeUser(db, { isAgent: true });
    const top = await launch({ name: "Top" });
    const jury = await launch({ name: "Juriu" });
    const middle = await launch({ name: "Mijloc" });
    const late = await launch({ name: "Târziu", isLate: true });
    const bestAgent = await launch({ name: "Agent bun" }, agent);
    const otherAgent = await launch({ name: "Agent slab" }, agent);
    await vote(db, top.id, 5);
    await vote(db, middle.id, 4);
    await vote(db, bestAgent.id, 3);
    await vote(db, otherAgent.id, 1);
    await vote(db, late.id, 2);
    await addExtra(db, challenge.id, "humans_above_agent", 20);
    await recognitions.save(admin.id, challenge.slug, {
      community: { projectId: top.id, reason: "Cele mai multe voturi: 5." },
      jury: { projectId: jury.id, reason: "Curat." },
      first_project: null,
    });

    const results = await recognitions.results({ challengeId: challenge.id });

    expect(
      results.recognitions.map((r) => [r.kind, r.project.name, r.reason]),
    ).toEqual([
      ["community", "Top", "Cele mai multe voturi: 5."],
      ["jury", "Juriu", "Curat."],
    ]);
    expect(results.bestAgent?.project.name).toBe("Agent bun");
    // Top and Mijloc have more votes; the fixtures add 20.
    expect(results.bestAgent?.humansAbove).toBe(22);
    expect(results.others.map((p) => [p.name, p.isLate])).toEqual([
      ["Mijloc", false],
      ["Târziu", true],
    ]);

    const withAgents = await recognitions.results({
      challengeId: challenge.id,
      agents: true,
    });
    expect(withAgents.others.map((p) => p.name)).toContain("Agent slab");
  });

  test("has no best agent without an agent's launch", async () => {
    const { recognitions, challenge, launch } = await setup();
    await launch();

    const results = await recognitions.results({ challengeId: challenge.id });

    expect(results.bestAgent).toBeNull();
    expect(results.recognitions).toEqual([]);
    expect(results.others).toHaveLength(1);
  });

  test("counts the challenge's human reviews and replies, not automated ones (rule 17)", async () => {
    const { db, recognitions, challenge, launch } = await setup();
    const a = await launch();
    const b = await launch({ stage: "in_progress", launchedAt: null });
    const parent = await review(db, a.id);
    await review(db, a.id, { parentId: parent.id });
    await review(db, b.id);
    await review(db, a.id, { isAutomated: true });
    await review(db, a.id, { hidden: true });
    await review(db, (await makeProject(db, { ownerId: a.ownerId })).id);
    await addExtra(db, a.id, "reviews", 4);
    await addExtra(db, challenge.id, "reviews", 100);

    const results = await recognitions.results({ challengeId: challenge.id });

    expect(results.reviews).toBe(3 + 4 + 100);
  });
});
