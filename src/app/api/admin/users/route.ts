import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import {
	ClassEntity,
	ClassTeacherEntity,
	MembershipEntity,
	SuggestionEntity,
	UserEntity,
	VoteEntity,
} from '@/db/entities'
import { fail } from '@/lib/access'

export const runtime = 'nodejs'
export async function GET() {
	const user = await currentUser()

	if (!user) return deny(401)
	if (user.role !== 'ADMIN') return deny()
	const users = await (await getDb()).getRepository(UserEntity).find()

	return Response.json(
		users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			googleId: u.googleId,
			role: u.role,
			blocked: u.blocked,
		})),
	)
}
export async function POST(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	if (user.role !== 'ADMIN') return deny()
	try {
		const data = z
			.object({
				name: z.string().trim().min(2).max(100),
				email: z.string().trim().toLowerCase().email(),
				role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).default('STUDENT'),
			})
			.parse(await req.json())
		const repo = (await getDb()).getRepository(UserEntity)

		if (await repo.findOneBy({ email: data.email }))
			return Response.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 })
		const created = await repo.save({ ...data, googleId: null, avatar: null, blocked: false })

		return Response.json(created, { status: 201 })
	} catch (e) {
		return fail(e)
	}
}
export async function PATCH(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	if (user.role !== 'ADMIN') return deny()
	try {
		const data = z
			.object({
				userId: z.string().uuid(),
				name: z.string().trim().min(2).max(100).optional(),
				email: z.string().trim().toLowerCase().email().nullable().optional(),
				role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).optional(),
				blocked: z.boolean().optional(),
			})
			.parse(await req.json())

		if (user.id === data.userId && (data.blocked || (data.role && data.role !== 'ADMIN')))
			return Response.json({ error: 'Você não pode remover seu próprio acesso administrativo.' }, { status: 400 })
		const repo = (await getDb()).getRepository(UserEntity)

		if (!(await repo.findOneBy({ id: data.userId })))
			return Response.json({ error: 'Usuário não encontrado.' }, { status: 404 })
		if (
			data.role === 'STUDENT' &&
			(await (await getDb()).getRepository(ClassTeacherEntity).countBy({ userId: data.userId })) > 0
		)
			return Response.json(
				{ error: 'Remova o usuário das turmas antes de alterar o perfil para aluno.' },
				{ status: 409 },
			)
		await repo.update(data.userId, {
			...(data.name ? { name: data.name } : {}),
			...(data.email !== undefined ? { email: data.email } : {}),
			...(data.role ? { role: data.role } : {}),
			...(data.blocked !== undefined ? { blocked: data.blocked } : {}),
		})

		return Response.json({ ok: true })
	} catch (e) {
		return fail(e)
	}
}
export async function DELETE(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	if (user.role !== 'ADMIN') return deny()
	try {
		const { userId } = z.object({ userId: z.string().uuid() }).parse(await req.json())

		if (user.id === userId)
			return Response.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 })
		const db = await getDb()

		await db.transaction(async (transaction) => {
			const owned = await transaction.getRepository(ClassEntity).findBy({ ownerId: userId })

			for (const room of owned) {
				const alternatives = (
					await transaction.getRepository(ClassTeacherEntity).findBy({ classId: room.id })
				).filter((item) => item.userId !== userId)

				if (alternatives.length)
					await transaction.getRepository(ClassEntity).update(room.id, { ownerId: alternatives[0].userId })
				else await transaction.getRepository(ClassEntity).delete({ id: room.id })
			}
			await transaction.getRepository(ClassTeacherEntity).delete({ userId })
			await transaction.getRepository(VoteEntity).delete({ userId })
			await transaction.getRepository(SuggestionEntity).delete({ userId })
			await transaction.getRepository(MembershipEntity).delete({ userId })
			await transaction.getRepository(UserEntity).delete({ id: userId })
		})

		return Response.json({ ok: true })
	} catch (e) {
		return fail(e)
	}
}
