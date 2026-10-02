import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1759100000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
		await q.query(
			`CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "googleId" varchar NOT NULL UNIQUE, name varchar NOT NULL, avatar varchar, role varchar NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('ADMIN','TEACHER','STUDENT')), blocked boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now())`,
		)
		await q.query(
			`CREATE TABLE classes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar NOT NULL, code varchar NOT NULL UNIQUE, "ownerId" uuid NOT NULL REFERENCES users(id), rules text NOT NULL DEFAULT '', "requireApproval" boolean NOT NULL DEFAULT true, "maxSuggestions" int NOT NULL DEFAULT 5, "createdAt" timestamptz NOT NULL DEFAULT now())`,
		)
		await q.query(
			`CREATE TABLE memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "classId" uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("classId","userId"))`,
		)
		await q.query(
			`CREATE TABLE suggestions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "classId" uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, "userId" uuid NOT NULL REFERENCES users(id), "youtubeVideoId" varchar NOT NULL, title varchar NOT NULL, artist varchar NOT NULL, artwork varchar, "durationMs" int NOT NULL, status varchar NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')), "playedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("classId","youtubeVideoId"))`,
		)
		await q.query(
			`CREATE TABLE votes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "suggestionId" uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("suggestionId","userId"))`,
		)
		await q.query(`CREATE INDEX idx_suggestions_class_status ON suggestions ("classId",status)`)
	}
	public async down(q: QueryRunner): Promise<void> {
		for (const t of ['votes', 'suggestions', 'memberships', 'classes', 'users']) await q.query(`DROP TABLE ${t}`)
	}
}
