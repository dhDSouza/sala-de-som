import { randomBytes } from 'crypto'
import { z } from 'zod'
import { currentUser, deny, manager } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import { ClassEntity, ClassTeacherEntity, MembershipEntity, PlaylistEntity, UserEntity } from '@/db/entities'
import { fail, withClassRelations } from '@/lib/access'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	if (!manager(user.role)) return deny()
	try {
		const body = z
			.object({
				name: z.string().trim().min(3).max(100),
				teacherIds: z.array(z.string().uuid()).optional(),
				rules: z.string().max(3000).default(''),
				requireApproval: z.boolean().default(true),
				maxSuggestions: z.number().int().min(0).max(30).default(5),
			})
			.parse(await req.json())
		const db = await getDb()
		const requestedTeachers =
			user.role === 'ADMIN' && body.teacherIds?.length ? body.teacherIds : [user.id, ...(body.teacherIds || [])]
		const teacherIds = [...new Set(requestedTeachers)]

		if (!teacherIds.length) return Response.json({ error: 'Selecione pelo menos um professor.' }, { status: 400 })
		const teachers = await db.getRepository(UserEntity).findByIds(teacherIds)

		if (teachers.length !== teacherIds.length || teachers.some((teacher) => !manager(teacher.role)))
			return Response.json(
				{ error: 'Todos os responsáveis devem ser professores ou administradores.' },
				{ status: 400 },
			)
		const room = await db.transaction(async (transaction) => {
			const created = await transaction.getRepository(ClassEntity).save({
				name: body.name,
				rules: body.rules,
				requireApproval: body.requireApproval,
				maxSuggestions: body.maxSuggestions,
				ownerId: teacherIds[0],
				code: randomBytes(4).toString('hex').toUpperCase(),
			})

			await transaction
				.getRepository(ClassTeacherEntity)
				.save(teacherIds.map((userId) => ({ classId: created.id, userId })))
			await transaction.getRepository(PlaylistEntity).save({ classId: created.id, name: 'Principal' })

			return created
		})

		return Response.json((await withClassRelations([room]))[0], { status: 201 })
	} catch (error) {
		return fail(error)
	}
}

export async function GET() {
	const user = await currentUser()

	if (!user) return deny(401)
	const db = await getDb()
	const rooms = await db.getRepository(ClassEntity).find()

	if (user.role === 'ADMIN') return Response.json(await withClassRelations(rooms))
	const [memberships, teaching] = await Promise.all([
		db.getRepository(MembershipEntity).findBy({ userId: user.id }),
		db.getRepository(ClassTeacherEntity).findBy({ userId: user.id }),
	])
	const allowed = new Set([...memberships.map((item) => item.classId), ...teaching.map((item) => item.classId)])

	return Response.json(
		await withClassRelations(
			rooms.filter((room) => allowed.has(room.id) || (user.role === 'TEACHER' && room.ownerId === user.id)),
		),
	)
}
