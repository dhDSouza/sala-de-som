export const origin = () => {
	const url = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000')

	if (!url || (process.env.NODE_ENV === 'production' && !url.startsWith('https://')))
		throw new Error('APP_URL deve apontar para a URL HTTPS pública em produção')

	return url.replace(/\/$/, '')
}
export const redirectUri = () => origin() + '/api/auth/google/callback'
