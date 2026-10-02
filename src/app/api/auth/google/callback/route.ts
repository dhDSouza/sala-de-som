import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/data-source'
import { UserEntity } from '@/db/entities'
import { sessionCookieOptions, sign } from '@/lib/auth'
import { origin, redirectUri } from '@/lib/google'

export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
	const code = req.nextUrl.searchParams.get('code')
	const state = req.nextUrl.searchParams.get('state')

	if (!code || !state || state !== req.cookies.get('oauth_state')?.value)
		return NextResponse.redirect(origin() + '/?error=oauth')
	try {
		const response = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUri(),
				client_id: process.env.GOOGLE_CLIENT_ID || '',
				client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
			}),
		})

		if (!response.ok) throw Error('Falha na autenticação')
		const token = await response.json()
		const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
			headers: { Authorization: `Bearer ${token.access_token}` },
		})

		if (!profileResponse.ok) throw Error('Perfil indisponível')
		const profile = await profileResponse.json()

		if (!profile.sub || !profile.email_verified) throw Error('Conta inválida')
		const repo = (await getDb()).getRepository(UserEntity)
		const email = String(profile.email).trim().toLowerCase()
		const existing = (await repo.findOneBy({ googleId: profile.sub })) || (await repo.findOneBy({ email }))

		if (existing?.passwordHash && !existing.googleId)
			return NextResponse.redirect(origin() + '/?error=local-account')
		const user = await repo.save({
			...(existing || {}),
			googleId: profile.sub,
			email,
			name: profile.name || profile.email || 'Usuário Google',
			avatar: existing?.avatar || profile.picture || null,
			role: existing?.role || (email === process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() ? 'ADMIN' : 'STUDENT'),
		})
		const res = NextResponse.redirect(origin() + '/')

		res.cookies.set('session', await sign(user.id), sessionCookieOptions)
		res.cookies.delete('oauth_state')

		return res
	} catch {
		return NextResponse.redirect(origin() + '/?error=google')
	}
}
