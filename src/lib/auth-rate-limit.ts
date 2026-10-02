import { createHash, randomInt } from 'crypto'
import { getDb } from '@/db/data-source'

type Action = 'login' | 'register'

function hashedKey(value: string) {
	return createHash('sha256').update(value).digest('hex')
}

async function consume(key: string, limit: number, minutes: number) {
	const db = await getDb()
	const rows: { count: number }[] = await db.query(
		`INSERT INTO auth_rate_limits (key, count, "windowStart") VALUES ($1, 1, now())
		 ON CONFLICT (key) DO UPDATE SET
		 count = CASE WHEN auth_rate_limits."windowStart" < now() - ($2::int * interval '1 minute')
			THEN 1 ELSE auth_rate_limits.count + 1 END,
		 "windowStart" = CASE WHEN auth_rate_limits."windowStart" < now() - ($2::int * interval '1 minute')
			THEN now() ELSE auth_rate_limits."windowStart" END
		 RETURNING count`,
		[key, minutes],
	)

	if (randomInt(100) === 0)
		await db.query(`DELETE FROM auth_rate_limits WHERE "windowStart" < now() - interval '2 days'`)

	return rows[0].count <= limit
}

export async function authRateLimited(req: Request, action: Action, email: string) {
	const minutes = action === 'login' ? 15 : 60
	const perEmail = action === 'login' ? 20 : 3
	const allowedEmail = await consume(hashedKey(`${action}:email:${email}`), perEmail, minutes)
	const trustedHeader = process.env.AUTH_IP_HEADER?.toLowerCase()
	const clientIp = trustedHeader ? req.headers.get(trustedHeader)?.split(',')[0]?.trim() : null
	const allowedIp = clientIp
		? await consume(hashedKey(`${action}:ip:${clientIp}`), action === 'login' ? 100 : 20, minutes)
		: true

	return !allowedEmail || !allowedIp
}

export function rateLimitResponse(action: Action) {
	return Response.json(
		{ error: 'Muitas tentativas. Aguarde e tente novamente.' },
		{ status: 429, headers: { 'Retry-After': action === 'login' ? '900' : '3600' } },
	)
}
