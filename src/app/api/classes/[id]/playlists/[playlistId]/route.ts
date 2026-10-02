import { currentUser, deny } from '@/lib/auth'
import { classAccess, canManageClass, fail } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { PlaylistEntity } from '@/db/entities'
import { playlistInput } from '@/lib/playlist-cover'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string; playlistId: string }> }

export async function PATCH(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const { id, playlistId } = await params
	const room = await classAccess(user, id)

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const { name, cover } = await playlistInput(req)
		const repo = (await getDb()).getRepository(PlaylistEntity)
		const playlist = await repo.findOneBy({ id: playlistId, classId: room.id })

		if (!playlist) return Response.json({ error: 'Playlist não encontrada.' }, { status: 404 })
		await repo.update(playlist.id, { name, ...(cover !== undefined ? { cover } : {}) })

		return Response.json({ ok: true })
	} catch (error) {
		return fail(error)
	}
}

export async function DELETE(_req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const { id, playlistId } = await params
	const room = await classAccess(user, id)

	if (!room || !(await canManageClass(user, room))) return deny()
	const repo = (await getDb()).getRepository(PlaylistEntity)
	const playlist = await repo.findOneBy({ id: playlistId, classId: room.id })

	if (!playlist) return Response.json({ error: 'Playlist não encontrada.' }, { status: 404 })
	if ((await repo.countBy({ classId: room.id })) === 1)
		return Response.json({ error: 'A turma precisa ter pelo menos uma playlist.' }, { status: 409 })
	await repo.remove(playlist)

	return Response.json({ ok: true })
}
