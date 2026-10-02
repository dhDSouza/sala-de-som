import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { classAccess, fail } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { SuggestionEntity, VoteEntity } from '@/db/entities'

export const runtime = 'nodejs'
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room) return deny()
	try {
		const { suggestionId } = z.object({ suggestionId: z.string().uuid() }).parse(await req.json())
		const db = await getDb()
		const track = await db
			.getRepository(SuggestionEntity)
			.findOneBy({ id: suggestionId, classId: room.id, status: 'APPROVED' })

		if (!track) return Response.json({ error: 'Música indisponível para votação.' }, { status: 404 })
		const repo = db.getRepository(VoteEntity)
		const old = await repo.findOneBy({ suggestionId, userId: user.id })

		if (old) await repo.remove(old)
		else await repo.save({ suggestionId, userId: user.id })

		return Response.json({ voted: !old })
	} catch (e) {
		return fail(e)
	}
}
