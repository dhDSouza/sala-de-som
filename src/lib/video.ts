export function videoId(input: string) {
	try {
		const url = new URL(input.trim())

		if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) return validId(url.pathname.split('/')[1])
		if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname))
			return null
		if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/'))
			return validId(url.pathname.split('/')[2])

		return validId(url.searchParams.get('v'))
	} catch {
		return validId(input.trim())
	}
}

function validId(value: string | null | undefined) {
	return value && /^[\w-]{11}$/.test(value) ? value : null
}

export function videoArtwork(id: string) {
	return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
