import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { getDb } from '@/db/data-source'
import { UserEntity, type User } from '@/db/entities'

const secret = () => {
	if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
		throw new Error('SESSION_SECRET inválido')

	return new TextEncoder().encode(process.env.SESSION_SECRET)
}

export async function sign(id: string) {
	return new SignJWT({ sub: id })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('7d')
		.sign(secret())
}
export const sessionCookieOptions = {
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production',
	maxAge: 604800,
	path: '/',
}
export async function currentUser(): Promise<User | null> {
	try {
		const token = (await cookies()).get('session')?.value

		if (!token) return null
		const { payload } = await jwtVerify(token, secret())

		return (await getDb()).getRepository(UserEntity).findOneBy({ id: payload.sub as string, blocked: false })
	} catch {
		return null
	}
}
export function deny(status = 403) {
	return Response.json(
		{ error: status === 401 ? 'Entre na sua conta para continuar.' : 'Acesso negado.' },
		{ status },
	)
}
export const manager = (role: string) => role === 'ADMIN' || role === 'TEACHER'
