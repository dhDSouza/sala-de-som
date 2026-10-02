import { MigrationInterface, QueryRunner } from 'typeorm'

export class PasswordLogin1759400000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE users ADD COLUMN "passwordHash" text`)
	}

	public async down(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE users DROP COLUMN "passwordHash"`)
	}
}
