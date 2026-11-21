import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { gameScores, savedVenues, studioCreations, users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  photoUrl?: string | null,
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
        photoUrl: photoUrl ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
          photoUrl: photoUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to sync user profile.', { cause: error });
  }
}

export async function getStudioCreationsByUid(uid: string) {
  try {
    const rows = await db
      .select({
        id: studioCreations.id,
        kind: studioCreations.kind,
        title: studioCreations.title,
        prompt: studioCreations.prompt,
        model: studioCreations.model,
        mediaUrl: studioCreations.mediaUrl,
        metadataJson: studioCreations.metadataJson,
        createdAt: studioCreations.createdAt,
      })
      .from(studioCreations)
      .innerJoin(users, eq(studioCreations.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(studioCreations.createdAt))
      .limit(40);
    return rows;
  } catch (error) {
    console.error('Database query failed in getStudioCreationsByUid:', error);
    throw new Error('Failed to load studio creations.', { cause: error });
  }
}

export async function saveStudioCreationForUid(
  uid: string,
  email: string,
  payload: {
    kind: string;
    title: string;
    prompt: string;
    model: string;
    mediaUrl?: string | null;
    metadataJson?: string | null;
  },
  displayName?: string | null,
  photoUrl?: string | null,
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName, photoUrl);
    const [created] = await db
      .insert(studioCreations)
      .values({
        userId: user.id,
        kind: payload.kind,
        title: payload.title,
        prompt: payload.prompt,
        model: payload.model,
        mediaUrl: payload.mediaUrl ?? null,
        metadataJson: payload.metadataJson ?? null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in saveStudioCreationForUid:', error);
    throw new Error('Failed to save studio creation.', { cause: error });
  }
}

export async function deleteStudioCreationForUid(uid: string, creationId: number) {
  try {
    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!user) return false;
    const deleted = await db
      .delete(studioCreations)
      .where(and(eq(studioCreations.id, creationId), eq(studioCreations.userId, user.id)))
      .returning({ id: studioCreations.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteStudioCreationForUid:', error);
    throw new Error('Failed to delete studio creation.', { cause: error });
  }
}

export async function getLeaderboard(limit = 20) {
  try {
    return await db
      .select({
        id: gameScores.id,
        playerName: gameScores.playerName,
        score: gameScores.score,
        maxCombo: gameScores.maxCombo,
        accuracy: gameScores.accuracy,
        difficulty: gameScores.difficulty,
        createdAt: gameScores.createdAt,
      })
      .from(gameScores)
      .orderBy(desc(gameScores.score))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in getLeaderboard:', error);
    throw new Error('Failed to load stage game leaderboard.', { cause: error });
  }
}

export async function saveGameScore(payload: {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  playerName: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  difficulty: string;
}) {
  try {
    let userId: number | null = null;
    if (payload.uid && payload.email) {
      const user = await getOrCreateUser(
        payload.uid,
        payload.email,
        payload.displayName,
        payload.photoUrl,
      );
      userId = user.id;
    }
    const [inserted] = await db
      .insert(gameScores)
      .values({
        userId,
        playerName: payload.playerName,
        score: payload.score,
        maxCombo: payload.maxCombo,
        accuracy: payload.accuracy,
        difficulty: payload.difficulty,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in saveGameScore:', error);
    throw new Error('Failed to save game score.', { cause: error });
  }
}

export async function getSavedVenuesByUid(uid: string) {
  try {
    return await db
      .select({
        id: savedVenues.id,
        placeId: savedVenues.placeId,
        name: savedVenues.name,
        address: savedVenues.address,
        category: savedVenues.category,
        lat: savedVenues.lat,
        lng: savedVenues.lng,
        createdAt: savedVenues.createdAt,
      })
      .from(savedVenues)
      .innerJoin(users, eq(savedVenues.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(savedVenues.createdAt))
      .limit(50);
  } catch (error) {
    console.error('Database query failed in getSavedVenuesByUid:', error);
    throw new Error('Failed to load saved venues.', { cause: error });
  }
}

export async function saveVenueForUid(
  uid: string,
  email: string,
  venue: {
    placeId: string;
    name: string;
    address: string;
    category: string;
    lat: string;
    lng: string;
  },
  displayName?: string | null,
  photoUrl?: string | null,
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName, photoUrl);
    const [inserted] = await db
      .insert(savedVenues)
      .values({
        userId: user.id,
        placeId: venue.placeId,
        name: venue.name,
        address: venue.address,
        category: venue.category,
        lat: venue.lat,
        lng: venue.lng,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in saveVenueForUid:', error);
    throw new Error('Failed to save venue.', { cause: error });
  }
}

export async function deleteSavedVenueForUid(uid: string, venueId: number) {
  try {
    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!user) return false;
    const deleted = await db
      .delete(savedVenues)
      .where(and(eq(savedVenues.id, venueId), eq(savedVenues.userId, user.id)))
      .returning({ id: savedVenues.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteSavedVenueForUid:', error);
    throw new Error('Failed to remove saved venue.', { cause: error });
  }
}
