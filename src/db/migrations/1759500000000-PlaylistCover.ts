import { MigrationInterface, QueryRunner } from 'typeorm'

export class PlaylistCover1759500000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE playlists ADD COLUMN cover text`)
	}

	public async down(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE playlists DROP COLUMN cover`)
	}
}
