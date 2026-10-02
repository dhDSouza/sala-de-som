import { MigrationInterface, QueryRunner } from 'typeorm'

export class AuthProtection1759600000000 implements MigrationInterface {
	public async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE pending_registrations (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			email varchar NOT NULL UNIQUE,
			name varchar NOT NULL,
			"passwordHash" text NOT NULL,
			"tokenHash" varchar NOT NULL UNIQUE,
			"expiresAt" timestamptz NOT NULL
		)`)
		await q.query(`CREATE TABLE auth_rate_limits (
			key varchar PRIMARY KEY,
			count integer NOT NULL,
			"windowStart" timestamptz NOT NULL
		)`)
	}

	public async down(q: QueryRunner): Promise<void> {
		await q.query('DROP TABLE auth_rate_limits')
		await q.query('DROP TABLE pending_registrations')
	}
}
