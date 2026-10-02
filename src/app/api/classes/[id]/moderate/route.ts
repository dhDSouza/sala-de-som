import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { canManageClass, classAccess, fail } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { ClassEntity, SuggestionEntity } from '@/db/entities'

export const runtime = 'nodejs'
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const body = z
			.discriminatedUnion('action', [
				z.object({ action: z.literal('approve'), suggestionId: z.string().uuid() }),
				z.object({ action: z.literal('reject'), suggestionId: z.string().uuid() }),
				z.object({
					action: z.literal('rules'),
					rules: z.string().max(3000),
					requireApproval: z.boolean(),
					maxSuggestions: z.number().int().min(0).max(30),
				}),
			])
			.parse(await req.json())
		const db = await getDb()

		if (body.action === 'rules') {
			await db.getRepository(ClassEntity).update(room.id, {
				rules: body.rules,
				requireApproval: body.requireApproval,
				maxSuggestions: body.maxSuggestions,
			})

			return Response.json({ ok: true })
		}
		const repo = db.getRepository(SuggestionEntity)
		const track = await repo.findOneBy({ id: body.suggestionId, classId: room.id })

		if (!track) return Response.json({ error: 'Sugestão não encontrada.' }, { status: 404 })
		await repo.update(track.id, { status: body.action === 'approve' ? 'APPROVED' : 'REJECTED' })

		return Response.json({ ok: true })
	} catch (e) {
		return fail(e)
	}
}
