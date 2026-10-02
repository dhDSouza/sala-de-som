import { currentUser, deny } from '@/lib/auth'
import { classAccess, canManageClass, fail } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { PlaylistEntity } from '@/db/entities'
import { playlistInput, publicPlaylist } from '@/lib/playlist-cover'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room) return deny()
	const playlists = await (await getDb()).getRepository(PlaylistEntity).findBy({ classId: room.id })

	return Response.json(playlists.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(publicPlaylist))
}

export async function POST(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const { name, cover } = await playlistInput(req)
		const playlist = await (
			await getDb()
		)
			.getRepository(PlaylistEntity)
			.save({ classId: room.id, name, cover: cover || null })

		return Response.json(publicPlaylist(playlist), { status: 201 })
	} catch (error) {
		return fail(error)
	}
}
