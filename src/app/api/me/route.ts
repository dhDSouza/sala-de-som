import { currentUser, deny } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import { ClassEntity, ClassTeacherEntity, MembershipEntity } from '@/db/entities'
import { withClassRelations } from '@/lib/access'

export const runtime = 'nodejs'
export async function GET() {
	const user = await currentUser()

	if (!user) return deny(401)
	const db = await getDb()
	const member = await db.getRepository(MembershipEntity).findBy({ userId: user.id })
	const teaching = await db.getRepository(ClassTeacherEntity).findBy({ userId: user.id })
	const owned = user.role === 'TEACHER' ? await db.getRepository(ClassEntity).findBy({ ownerId: user.id }) : []
	const classes =
		user.role === 'ADMIN'
			? await db.getRepository(ClassEntity).find()
			: await db
					.getRepository(ClassEntity)
					.findByIds([
						...new Set([
							...teaching.map((item) => item.classId),
							...member.map((item) => item.classId),
							...owned.map((item) => item.id),
						]),
					])

	return Response.json({
		user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role },
		classes: await withClassRelations(classes),
	})
}
