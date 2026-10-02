import { createHash } from 'crypto'
import { z } from 'zod'
import { getDb } from '@/db/data-source'
import { PendingRegistrationEntity, UserEntity } from '@/db/entities'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(await req.json().catch(() => null))

	if (!parsed.success) return Response.json({ error: 'Link inválido ou expirado.' }, { status: 400 })
	const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
	const headers = { 'Cache-Control': 'no-store' }

	try {
		const db = await getDb()

		await db.transaction(async (manager) => {
			const pending = await manager.getRepository(PendingRegistrationEntity).findOne({
				where: { tokenHash },
				lock: { mode: 'pessimistic_write' },
			})

			if (!pending || pending.expiresAt.getTime() <= Date.now()) throw new Error('invalid')
			if (await manager.getRepository(UserEntity).findOneBy({ email: pending.email }))
				throw new Error('duplicate')
			await manager.getRepository(UserEntity).save({
				name: pending.name,
				email: pending.email,
				passwordHash: pending.passwordHash,
				googleId: null,
				avatar: null,
				role: 'STUDENT',
				blocked: false,
			})
			await manager.getRepository(PendingRegistrationEntity).delete({ id: pending.id })
		})

		return Response.json({ ok: true }, { headers })
	} catch {
		return Response.json(
			{ error: 'Link inválido ou expirado. Faça o cadastro novamente.' },
			{ status: 400, headers },
		)
	}
}
