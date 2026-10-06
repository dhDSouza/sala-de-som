import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { canManageClass, classAccess, fail, withClassRelations } from '@/lib/access'
import { getDb } from '@/db/data-source'
import { PlaylistEntity, SuggestionEntity } from '@/db/entities'
import { videoArtwork, videoId } from '@/lib/video'
import { publicPlaylist } from '@/lib/playlist-cover'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room) return deny()
	const db = await getDb()
	const requestedPlaylistId = new URL(req.url).searchParams.get('playlistId')
	const playlistRepo = db.getRepository(PlaylistEntity)
	const playlist = requestedPlaylistId
		? await playlistRepo.findOneBy({ id: requestedPlaylistId, classId: room.id })
		: await playlistRepo.findOne({ where: { classId: room.id }, order: { createdAt: 'ASC' } })

	if (!playlist) return Response.json({ error: 'Playlist não encontrada.' }, { status: 404 })
	const tracks = await db.getRepository(SuggestionEntity).findBy({ playlistId: playlist.id })
	const visibleTracks = (await canManageClass(user, room))
		? tracks
		: tracks.filter((track) => track.status === 'APPROVED')
	const trackIds = visibleTracks.map((track) => track.id)
	const userIds = [...new Set(visibleTracks.map((track) => track.userId))]
	const voteRows: { suggestionId: string; votes: number; voted: boolean }[] = trackIds.length
		? await db.query(
				`SELECT "suggestionId", count(*)::int AS votes, bool_or("userId" = $2) AS voted
				 FROM votes WHERE "suggestionId" = ANY($1::uuid[]) GROUP BY "suggestionId"`,
				[trackIds, user.id],
			)
		: []
	const userRows: { id: string; name: string; hasAvatar: boolean }[] = userIds.length
		? await db.query('SELECT id, name, avatar IS NOT NULL AS "hasAvatar" FROM users WHERE id = ANY($1::uuid[])', [
				userIds,
			])
		: []
	const votesByTrack = new Map(voteRows.map((row) => [row.suggestionId, row]))
	const usersById = new Map(userRows.map((candidate) => [candidate.id, candidate]))

	return Response.json({
		room: (await withClassRelations([room]))[0],
		playlist: publicPlaylist(playlist),
		tracks: visibleTracks
			.map((track) => ({
				...track,
				votes: votesByTrack.get(track.id)?.votes || 0,
				voted: votesByTrack.get(track.id)?.voted || false,
				suggestedBy: usersById.get(track.userId)?.name || 'Usuário removido',
				suggestedAvatar: usersById.get(track.userId)?.hasAvatar
					? `/api/classes/${room.id}/avatars/${track.userId}`
					: null,
			}))
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)),
	})
}

export async function POST(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room) return deny()

	const canManageRoom = await canManageClass(user, room)

	try {
		const body = z
			.object({
				url: z.string().trim().min(1),
				title: z.string().trim().min(1).max(200),
				artist: z.string().trim().max(150).default('Não informado'),
				playlistId: z.string().uuid().optional(),
			})
			.parse(await req.json())
		const id = videoId(body.url)

		if (!id) return Response.json({ error: 'Cole um link válido do YouTube ou YouTube Music.' }, { status: 400 })
		const db = await getDb()
		const repo = db.getRepository(SuggestionEntity)
		const playlist = body.playlistId
			? await db.getRepository(PlaylistEntity).findOneBy({ id: body.playlistId, classId: room.id })
			: await db
					.getRepository(PlaylistEntity)
					.findOne({ where: { classId: room.id }, order: { createdAt: 'ASC' } })

		if (!playlist) return Response.json({ error: 'Playlist não encontrada.' }, { status: 404 })
		if (await repo.findOneBy({ playlistId: playlist.id, youtubeVideoId: id }))
			return Response.json({ error: 'Este vídeo já foi sugerido.' }, { status: 409 })
		if (!canManageRoom && room.maxSuggestions > 0) {
			const count = await repo.countBy({ classId: room.id, userId: user.id })

			if (count >= room.maxSuggestions)
				return Response.json({ error: 'Você atingiu o limite de sugestões desta turma.' }, { status: 409 })
		}
		const status = room.requireApproval && !canManageRoom ? 'PENDING' : 'APPROVED'
		const suggestion = await repo.save({
			classId: room.id,
			playlistId: playlist.id,
			userId: user.id,
			youtubeVideoId: id,
			title: body.title,
			artist: body.artist || 'Não informado',
			artwork: videoArtwork(id),
			durationMs: 0,
			status,
		})

		return Response.json(suggestion, { status: 201 })
	} catch (error) {
		return fail(error)
	}
}

export async function PATCH(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const data = z
			.object({
				suggestionId: z.string().uuid(),
				title: z.string().trim().min(1).max(200).optional(),
				artist: z.string().trim().min(1).max(150).optional(),
				status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
			})
			.parse(await req.json())
		const repo = (await getDb()).getRepository(SuggestionEntity)
		const track = await repo.findOneBy({ id: data.suggestionId, classId: room.id })

		if (!track) return Response.json({ error: 'Música não encontrada.' }, { status: 404 })
		await repo.update(track.id, {
			...(data.title ? { title: data.title } : {}),
			...(data.artist ? { artist: data.artist } : {}),
			...(data.status ? { status: data.status } : {}),
		})

		return Response.json({ ok: true })
	} catch (error) {
		return fail(error)
	}
}

export async function DELETE(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const room = await classAccess(user, (await params).id)

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const { suggestionId } = z.object({ suggestionId: z.string().uuid() }).parse(await req.json())
		const repo = (await getDb()).getRepository(SuggestionEntity)
		const track = await repo.findOneBy({ id: suggestionId, classId: room.id })

		if (!track) return Response.json({ error: 'Música não encontrada.' }, { status: 404 })
		await repo.remove(track)

		return Response.json({ ok: true })
	} catch (error) {
		return fail(error)
	}
}
