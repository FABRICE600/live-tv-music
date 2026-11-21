import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const studioCreations = pgTable('studio_creations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(), // 'music' | 'image' | 'video' | 'transcript'
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  model: text('model').notNull(),
  mediaUrl: text('media_url'),
  metadataJson: text('metadata_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gameScores = pgTable('game_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  playerName: text('player_name').notNull(),
  score: integer('score').notNull(),
  maxCombo: integer('max_combo').notNull(),
  accuracy: integer('accuracy').notNull(),
  difficulty: text('difficulty').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedVenues = pgTable('saved_venues', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  placeId: text('place_id').notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  category: text('category').notNull(),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  studioCreations: many(studioCreations),
  gameScores: many(gameScores),
  savedVenues: many(savedVenues),
}));

export const studioCreationsRelations = relations(studioCreations, ({ one }) => ({
  owner: one(users, {
    fields: [studioCreations.userId],
    references: [users.id],
  }),
}));

export const gameScoresRelations = relations(gameScores, ({ one }) => ({
  player: one(users, {
    fields: [gameScores.userId],
    references: [users.id],
  }),
}));

export const savedVenuesRelations = relations(savedVenues, ({ one }) => ({
  owner: one(users, {
    fields: [savedVenues.userId],
    references: [users.id],
  }),
}));
