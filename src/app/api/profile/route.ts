import { z } from 'zod'
import { currentUser, deny } from '@/lib/auth'
import { getDb } from '@/db/data-source'
import { UserEntity } from '@/db/entities'
import { fail } from '@/lib/access'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
	const user = await currentUser()

	if (!user) return deny(401)
	try {
		const form = await req.formData()
		const name = z.string().trim().min(2).max(100).parse(form.get('name'))
		const avatar = form.get('avatar')
		const removeAvatar = form.get('removeAvatar') === 'true'
		let nextAvatar = user.avatar

		if (removeAvatar) nextAvatar = null
		if (avatar instanceof File && avatar.size > 0) {
			if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(avatar.type))
				return Response.json({ error: 'Envie uma imagem JPG, PNG, WebP ou GIF.' }, { status: 400 })
			if (avatar.size > 2 * 1024 * 1024)
				return Response.json({ error: 'A imagem deve ter no máximo 2 MB.' }, { status: 400 })
			const bytes = Buffer.from(await avatar.arrayBuffer())

			nextAvatar = `data:${avatar.type};base64,${bytes.toString('base64')}`
		}
		await (await getDb()).getRepository(UserEntity).update(user.id, { name, avatar: nextAvatar })

		return Response.json({ ok: true, name, avatar: nextAvatar })
	} catch (error) {
		return fail(error)
	}
}
