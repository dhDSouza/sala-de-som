import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { origin, redirectUri } from '@/lib/google'

export const runtime = 'nodejs'
export async function GET(req: Request) {
	const requestedInvite = new URL(req.url).searchParams.get('invite')
	const invite = requestedInvite && /^[a-f0-9]{8}$/i.test(requestedInvite) ? requestedInvite.toUpperCase() : ''

	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		const fallback = new URL('/', origin())

		fallback.searchParams.set('error', 'google-unavailable')
		if (invite) fallback.searchParams.set('invite', invite)

		return NextResponse.redirect(fallback)
	}

	const state = randomBytes(24).toString('hex')
	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')

	url.search = new URLSearchParams({
		response_type: 'code',
		client_id: process.env.GOOGLE_CLIENT_ID || '',
		scope: 'openid email profile',
		redirect_uri: redirectUri(),
		state,
		prompt: 'select_account',
	}).toString()
	const res = NextResponse.redirect(url)

	res.cookies.set('oauth_state', state, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 600,
		path: '/',
	})
	if (invite)
		res.cookies.set('oauth_invite', invite, {
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 600,
			path: '/',
		})
	else res.cookies.delete('oauth_invite')

	return res
}
