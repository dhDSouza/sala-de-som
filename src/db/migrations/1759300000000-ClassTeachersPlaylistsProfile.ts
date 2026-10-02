import { MigrationInterface, QueryRunner } from 'typeorm'

export class ClassTeachersPlaylistsProfile1759300000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE users ALTER COLUMN avatar TYPE text`)
		await q.query(
			`CREATE TABLE class_teachers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "classId" uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("classId", "userId"))`,
		)
		await q.query(
			`INSERT INTO class_teachers ("classId", "userId") SELECT id, "ownerId" FROM classes ON CONFLICT DO NOTHING`,
		)
		await q.query(
			`CREATE TABLE playlists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "classId" uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, name varchar NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("classId", name))`,
		)
		await q.query(`INSERT INTO playlists ("classId", name) SELECT id, 'Principal' FROM classes`)
		await q.query(`ALTER TABLE suggestions ADD COLUMN "playlistId" uuid`)
		await q.query(`UPDATE suggestions s SET "playlistId" = p.id FROM playlists p WHERE p."classId" = s."classId"`)
		await q.query(`ALTER TABLE suggestions ALTER COLUMN "playlistId" SET NOT NULL`)
		await q.query(
			`ALTER TABLE suggestions ADD CONSTRAINT "FK_suggestions_playlist" FOREIGN KEY ("playlistId") REFERENCES playlists(id) ON DELETE CASCADE`,
		)
		await q.query(`DO $$
			DECLARE old_constraint text;
			BEGIN
				SELECT con.conname INTO old_constraint
				FROM pg_constraint con
				JOIN pg_class rel ON rel.oid = con.conrelid
				WHERE rel.relname = 'suggestions'
					AND con.contype = 'u'
					AND pg_get_constraintdef(con.oid) LIKE '%"classId"%"youtubeVideoId"%'
				LIMIT 1;
				IF old_constraint IS NOT NULL THEN
					EXECUTE format('ALTER TABLE suggestions DROP CONSTRAINT %I', old_constraint);
				END IF;
			END $$`)
		await q.query(
			`ALTER TABLE suggestions ADD CONSTRAINT "UQ_suggestions_playlist_video" UNIQUE ("playlistId", "youtubeVideoId")`,
		)
		await q.query(`CREATE INDEX idx_suggestions_playlist_status ON suggestions ("playlistId", status)`)
	}

	public async down(q: QueryRunner): Promise<void> {
		await q.query(`DROP INDEX idx_suggestions_playlist_status`)
		await q.query(`ALTER TABLE suggestions DROP CONSTRAINT "UQ_suggestions_playlist_video"`)
		await q.query(`ALTER TABLE suggestions DROP CONSTRAINT "FK_suggestions_playlist"`)
		await q.query(`ALTER TABLE suggestions DROP COLUMN "playlistId"`)
		await q.query(
			`ALTER TABLE suggestions ADD CONSTRAINT "suggestions_classId_youtubeVideoId_key" UNIQUE ("classId", "youtubeVideoId")`,
		)
		await q.query(`DROP TABLE playlists`)
		await q.query(`DROP TABLE class_teachers`)
		await q.query(`ALTER TABLE users ALTER COLUMN avatar TYPE varchar`)
	}
}
