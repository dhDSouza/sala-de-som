import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/db/data-source'
import { UserEntity } from '@/db/entities'
import { verifyPassword } from '@/lib/password'
import { sessionCookieOptions, sign } from '@/lib/auth'
import { authRateLimited, rateLimitResponse } from '@/lib/auth-rate-limit'

export const runtime = 'nodejs'

const credentials = z.object({
	email: z.email().trim().toLowerCase().max(254),
	password: z.string().min(1).max(128),
})

export async function POST(req: Request) {
	const parsed = credentials.safeParse(await req.json().catch(() => null))

	if (!parsed.success) return Response.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
	const { email, password } = parsed.data

	if (await authRateLimited(req, 'login', email)) return rateLimitResponse('login')
	const user = await (await getDb()).getRepository(UserEntity).findOneBy({ email })

	if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash)) || user.blocked)
		return Response.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
	const response = NextResponse.json({ ok: true })

	response.cookies.set('session', await sign(user.id), sessionCookieOptions)

	return response
}
