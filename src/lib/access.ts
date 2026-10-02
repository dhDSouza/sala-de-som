import { getDb } from '@/db/data-source'
import { In } from 'typeorm'
import {
	ClassEntity,
	ClassTeacherEntity,
	MembershipEntity,
	PlaylistEntity,
	UserEntity,
	type ClassRoom,
	type User,
} from '@/db/entities'
import { publicPlaylist } from '@/lib/playlist-cover'

export async function classAccess(user: User, id: string) {
	const db = await getDb()
	const room = await db.getRepository(ClassEntity).findOneBy({ id })

	if (!room) return null
	const membership = await db.getRepository(MembershipEntity).findOneBy({ classId: id, userId: user.id })
	const teaching = await db.getRepository(ClassTeacherEntity).findOneBy({ classId: id, userId: user.id })

	if (user.role !== 'ADMIN' && !(user.role === 'TEACHER' && (room.ownerId === user.id || teaching)) && !membership)
		return null

	return room
}
export async function canManageClass(user: User, room: ClassRoom) {
	if (user.role === 'ADMIN') return true
	if (user.role !== 'TEACHER') return false
	if (room.ownerId === user.id) return true

	return Boolean(
		await (await getDb()).getRepository(ClassTeacherEntity).findOneBy({ classId: room.id, userId: user.id }),
	)
}
export async function withClassRelations(rooms: ClassRoom[]) {
	if (!rooms.length) return []
	const db = await getDb()
	const roomIds = rooms.map((room) => room.id)
	const teachers = await db.getRepository(ClassTeacherEntity).findBy({ classId: In(roomIds) })
	const playlists = await db.getRepository(PlaylistEntity).findBy({ classId: In(roomIds) })

	return rooms.map((room) => ({
		...room,
		teacherIds: [
			...new Set([
				room.ownerId,
				...teachers.filter((teacher) => teacher.classId === room.id).map((teacher) => teacher.userId),
			]),
		],
		playlists: playlists
			.filter((playlist) => playlist.classId === room.id)
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.map(publicPlaylist),
	}))
}
export async function ownerFor(user: User, ownerId: string) {
	if (user.id === ownerId) return user

	return (await getDb()).getRepository(UserEntity).findOneBy({ id: ownerId })
}
export function fail(e: unknown) {
	return Response.json({ error: e instanceof Error ? e.message : 'Falha inesperada.' }, { status: 400 })
}
