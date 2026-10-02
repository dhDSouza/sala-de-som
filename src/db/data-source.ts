import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { entities } from './entities'

export const db = new DataSource({
	type: 'postgres',
	url: process.env.DATABASE_URL,
	entities,
	migrations: [__dirname + '/migrations/*.{ts,js}'],
	synchronize: false,
})
export async function getDb() {
	if (!db.isInitialized) await db.initialize()

	return db
}
