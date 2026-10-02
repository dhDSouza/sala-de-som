import { getDb } from '@/db/data-source'
import { SuggestionEntity, UserEntity } from '@/db/entities'
import { classAccess } from '@/lib/access'
import { currentUser, deny } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
	const viewer = await currentUser()

	if (!viewer) return deny(401)
	const { id, userId } = await params
	const room = await classAccess(viewer, id)

	if (!room) return deny()
	const db = await getDb()

	if (!(await db.getRepository(SuggestionEntity).existsBy({ classId: room.id, userId })))
		return new Response(null, { status: 404 })
	const avatar = (await db.getRepository(UserEntity).findOneBy({ id: userId }))?.avatar

	if (!avatar) return new Response(null, { status: 404 })
	const uploaded = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(avatar)

	if (uploaded)
		return new Response(new Uint8Array(Buffer.from(uploaded[2], 'base64')), {
			headers: { 'Content-Type': uploaded[1], 'Cache-Control': 'private, max-age=300' },
		})
	if (avatar.startsWith('https://')) return Response.redirect(avatar)

	return new Response(null, { status: 404 })
}
