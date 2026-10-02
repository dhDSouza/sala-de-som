import { currentUser, deny } from '@/lib/auth'
import { classAccess } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { PlaylistEntity } from '@/db/entities'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; playlistId: string }> }) {
	const user = await currentUser()

	if (!user) return deny(401)
	const { id, playlistId } = await params
	const room = await classAccess(user, id)

	if (!room) return deny()
	const playlist = await (await getDb()).getRepository(PlaylistEntity).findOneBy({ id: playlistId, classId: room.id })
	const cover = playlist?.cover

	if (!cover) return new Response(null, { status: 404 })
	const encoded = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(cover)

	if (!encoded) return new Response(null, { status: 404 })

	return new Response(new Uint8Array(Buffer.from(encoded[2], 'base64')), {
		headers: { 'Content-Type': encoded[1], 'Cache-Control': 'private, no-store' },
	})
}
