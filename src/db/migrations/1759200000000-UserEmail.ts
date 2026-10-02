import { MigrationInterface, QueryRunner } from 'typeorm'

export class UserEmail1759200000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`ALTER TABLE users ALTER COLUMN "googleId" DROP NOT NULL`)
		await q.query(`ALTER TABLE users ADD COLUMN email varchar`)
		await q.query(`CREATE UNIQUE INDEX "IDX_users_email" ON users (email) WHERE email IS NOT NULL`)
	}

	public async down(q: QueryRunner): Promise<void> {
		await q.query(`DROP INDEX "IDX_users_email"`)
		await q.query(`ALTER TABLE users DROP COLUMN email`)
		await q.query(`DELETE FROM users WHERE "googleId" IS NULL`)
		await q.query(`ALTER TABLE users ALTER COLUMN "googleId" SET NOT NULL`)
	}
}
