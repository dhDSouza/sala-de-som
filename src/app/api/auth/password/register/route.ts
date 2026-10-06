import { createHash, randomBytes, randomInt } from 'crypto'
import { LessThan } from 'typeorm'
import { z } from 'zod'
import { getDb } from '@/db/data-source'
import { PendingRegistrationEntity, UserEntity } from '@/db/entities'
import { hashPassword } from '@/lib/password'
import { authRateLimited, rateLimitResponse } from '@/lib/auth-rate-limit'
import { emailDeliveryConfigured, sendVerificationEmail } from '@/lib/verification-email'

export const runtime = 'nodejs'

const credentials = z.object({
	name: z.string().trim().min(2).max(100),
	email: z.email().trim().toLowerCase().max(254),
	password: z.string().min(8).max(128),
	invite: z
		.string()
		.regex(/^[a-f0-9]{8}$/i)
		.optional(),
})

export async function POST(req: Request) {
	const parsed = credentials.safeParse(await req.json().catch(() => null))

	if (!parsed.success)
		return Response.json({ error: 'Informe nome, e-mail válido e senha de 8 a 128 caracteres.' }, { status: 400 })
	const { name, email, password, invite } = parsed.data

	if (!emailDeliveryConfigured())
		return Response.json(
			{ error: 'Cadastro por senha indisponível: envio de e-mail não configurado.' },
			{ status: 503 },
		)
	if (await authRateLimited(req, 'register', email)) return rateLimitResponse('register')
	const db = await getDb()

	if (randomInt(100) === 0)
		await db.getRepository(PendingRegistrationEntity).delete({ expiresAt: LessThan(new Date()) })

	if (await db.getRepository(UserEntity).findOneBy({ email })) return Response.json({ ok: true, pending: true })
	try {
		const token = randomBytes(32).toString('hex')

		await db.getRepository(PendingRegistrationEntity).upsert(
			{
				name,
				email,
				passwordHash: await hashPassword(password),
				tokenHash: createHash('sha256').update(token).digest('hex'),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			},
			['email'],
		)
		await sendVerificationEmail(email, name, token, invite)

		return Response.json({ ok: true, pending: true }, { status: 202 })
	} catch {
		return Response.json(
			{ error: 'Não foi possível enviar a confirmação. Tente novamente mais tarde.' },
			{ status: 503 },
		)
	}
}
