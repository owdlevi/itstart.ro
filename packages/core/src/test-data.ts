import {
  challenges,
  fixtureCountExtras,
  participations,
  projectUpdates,
  projects,
  questions,
  reviews,
  users,
  votes,
  type Db,
} from "@repo/db";

// Rows for tests, with every required column filled in. Override what a test is about.

export async function makeUser(
  db: Db,
  fields: Partial<typeof users.$inferInsert> = {},
) {
  const [row] = await db
    .insert(users)
    .values({
      name: "Ana Pop",
      email: `${crypto.randomUUID()}@test.invalid`,
      ...fields,
    })
    .returning();
  return row!;
}

let challengeNumber = 0;
export async function makeChallenge(
  db: Db,
  fields: Partial<typeof challenges.$inferInsert> = {},
) {
  const number = ++challengeNumber;
  const [row] = await db
    .insert(challenges)
    .values({
      number,
      slug: `provocare-${number}`,
      title: `Provocarea ${number}`,
      // November 2026, Europe/Bucharest
      startsAt: new Date("2026-10-31T22:00:00Z"),
      endsAt: new Date("2026-11-30T21:59:00Z"),
      ...fields,
    })
    .returning();
  return row!;
}

export async function makeProject(
  db: Db,
  fields: Partial<typeof projects.$inferInsert> & { ownerId: string },
) {
  const slug = crypto.randomUUID();
  const [row] = await db
    .insert(projects)
    .values({
      slug,
      name: slug,
      pitch: "O frază.",
      liveUrl: `https://${slug}.example`,
      stage: "launched",
      ...fields,
    })
    .returning();
  return row!;
}

export async function join(
  db: Db,
  userId: string,
  challengeId: string,
  leftAt: Date | null = null,
  joinedAt?: Date,
) {
  await db
    .insert(participations)
    .values({ userId, challengeId, leftAt, joinedAt });
}

export async function addUpdate(
  db: Db,
  projectId: string,
  version: number,
  createdAt: Date,
  text = `v${version}`,
) {
  await db
    .insert(projectUpdates)
    .values({ projectId, version, text, createdAt });
}

export async function vote(db: Db, projectId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const voter = await makeUser(db);
    await db.insert(votes).values({ userId: voter.id, projectId });
  }
}

export async function review(
  db: Db,
  projectId: string,
  fields: Partial<typeof reviews.$inferInsert> = {},
) {
  const author = await makeUser(db);
  const [row] = await db
    .insert(reviews)
    .values({ projectId, authorId: author.id, body: "Merge.", ...fields })
    .returning();
  return row!;
}

export async function addExtra(
  db: Db,
  subjectId: string,
  metric: (typeof fixtureCountExtras.$inferInsert)["metric"],
  n: number,
) {
  await db.insert(fixtureCountExtras).values({ subjectId, metric, n });
}

export async function ask(
  db: Db,
  challengeId: string,
  fields: Partial<typeof questions.$inferInsert> = {},
) {
  const author = fields.authorId ? null : await makeUser(db);
  const slug = crypto.randomUUID();
  const [row] = await db
    .insert(questions)
    .values({
      challengeId,
      authorId: author?.id ?? fields.authorId!,
      slug,
      title: slug,
      ...fields,
    })
    .returning();
  return row!;
}
