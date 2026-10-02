import { createHash } from 'crypto'
import { z } from 'zod'
import type { Playlist } from '@/db/entities'

const maxCoverSize = 2 * 1024 * 1024
const nameSchema = z.string().trim().min(2).max(100)
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

function validImage(bytes: Uint8Array, type: string) {
	if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
	if (type === 'image/png')
		return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
	if (type === 'image/webp')
		return (
			Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' &&
			Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP'
		)
	if (type === 'image/gif') {
		const signature = Buffer.from(bytes.subarray(0, 6)).toString()

		return signature === 'GIF87a' || signature === 'GIF89a'
	}

	return false
}

export async function playlistInput(req: Request) {
	if (!req.headers.get('content-type')?.startsWith('multipart/form-data')) {
		const { name } = z.object({ name: nameSchema }).parse(await req.json())

		return { name, cover: undefined as string | null | undefined }
	}
	const form = await req.formData()
	const name = nameSchema.parse(form.get('name'))
	const file = form.get('cover')

	if (file instanceof File && file.size > 0) {
		if (!imageTypes.includes(file.type as (typeof imageTypes)[number]))
			throw Error('Envie uma capa JPG, PNG, WebP ou GIF.')
		if (file.size > maxCoverSize) throw Error('A capa deve ter no máximo 2 MB.')
		const bytes = new Uint8Array(await file.arrayBuffer())

		if (!validImage(bytes, file.type)) throw Error('O arquivo não é uma imagem válida.')

		return { name, cover: `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}` }
	}

	return { name, cover: form.get('removeCover') === 'on' ? null : undefined }
}

export function publicPlaylist(playlist: Playlist) {
	const { cover, ...data } = playlist

	return {
		...data,
		coverUrl: cover
			? `/api/classes/${playlist.classId}/playlists/${playlist.id}/cover?v=${createHash('sha256').update(cover).digest('hex').slice(0, 12)}`
			: null,
	}
}
