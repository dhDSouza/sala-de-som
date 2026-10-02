import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import { ClassEntity, MembershipEntity } from '@/db/entities'
import { fail } from '@/lib/access'

export const runtime = 'nodejs'
export async function POST(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	try {
		const { code } = z.object({ code: z.string().trim().min(4) }).parse(await req.json())
		const db = await getDb()
		const room = await db.getRepository(ClassEntity).findOneBy({ code: code.toUpperCase() })

		if (!room) return Response.json({ error: 'Código da turma não encontrado.' }, { status: 404 })
		await db
			.getRepository(MembershipEntity)
			.createQueryBuilder()
			.insert()
			.values({ classId: room.id, userId: user.id })
			.orIgnore()
			.execute()

		return Response.json(room)
	} catch (e) {
		return fail(e)
	}
}
