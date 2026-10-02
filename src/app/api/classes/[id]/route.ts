import { z } from 'zod'
import { currentUser, deny, manager } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import { ClassEntity, ClassTeacherEntity, UserEntity } from '@/db/entities'
import { canManageClass, fail, withClassRelations } from '@/lib/access'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const db = await getDb()
	const room = await db.getRepository(ClassEntity).findOneBy({ id: (await params).id })

	if (!room || !(await canManageClass(user, room))) return deny()
	try {
		const data = z
			.object({
				name: z.string().trim().min(3).max(100).optional(),
				teacherIds: z.array(z.string().uuid()).min(1).optional(),
				rules: z.string().max(3000).optional(),
				requireApproval: z.boolean().optional(),
				maxSuggestions: z.number().int().min(0).max(30).optional(),
			})
			.parse(await req.json())

		if (data.teacherIds) {
			const teacherIds = [...new Set(data.teacherIds)]
			const teachers = await db.getRepository(UserEntity).findByIds(teacherIds)

			if (teachers.length !== teacherIds.length || teachers.some((teacher) => !manager(teacher.role)))
				return Response.json(
					{ error: 'Todos os responsáveis devem ser professores ou administradores.' },
					{ status: 400 },
				)
			await db.transaction(async (transaction) => {
				await transaction.getRepository(ClassTeacherEntity).delete({ classId: room.id })
				await transaction
					.getRepository(ClassTeacherEntity)
					.save(teacherIds.map((userId) => ({ classId: room.id, userId })))
				await transaction.getRepository(ClassEntity).update(room.id, {
					name: data.name,
					rules: data.rules,
					requireApproval: data.requireApproval,
					maxSuggestions: data.maxSuggestions,
					ownerId: teacherIds[0],
				})
			})
		} else {
			await db.getRepository(ClassEntity).update(room.id, data)
		}

		const updated = await db.getRepository(ClassEntity).findOneByOrFail({ id: room.id })

		return Response.json((await withClassRelations([updated]))[0])
	} catch (error) {
		return fail(error)
	}
}

export async function DELETE(_req: Request, { params }: Context) {
	const user = await currentUser()

	if (!user) return deny(401)
	const db = await getDb()
	const room = await db.getRepository(ClassEntity).findOneBy({ id: (await params).id })

	if (!room || !(await canManageClass(user, room))) return deny()
	await db.getRepository(ClassEntity).remove(room)

	return Response.json({ ok: true })
}
