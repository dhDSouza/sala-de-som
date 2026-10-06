'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Music2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { feedbackDuration } from '@/lib/feedback'
import FeedbackToast from '@/components/FeedbackToast'

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT'
type AdminUser = {
	id: string
	name: string
	email: string | null
	role: Role
	blocked: boolean
	googleId: string | null
}
type Room = {
	id: string
	name: string
	code: string
	ownerId: string
	rules: string
	requireApproval: boolean
	maxSuggestions: number
	teacherIds: string[]
	playlists: Playlist[]
}
type Playlist = { id: string; classId: string; name: string; coverUrl: string | null }
type Track = {
	id: string
	title: string
	artist: string
	status: 'PENDING' | 'APPROVED' | 'REJECTED'
	youtubeVideoId: string
}

async function request(path: string, options?: RequestInit) {
	const response = await fetch('/api' + path, {
		cache: 'no-store',
		...options,
		headers:
			options?.body instanceof FormData
				? options?.headers
				: { 'Content-Type': 'application/json', ...options?.headers },
	})
	const data = await response.json()

	if (!response.ok) throw new Error(data.error || 'Falha na solicitação.')

	return data
}

export default function AdminPanel({ onChanged }: { onChanged: () => Promise<void> }) {
	const [users, setUsers] = useState<AdminUser[]>([])
	const [userQuery, setUserQuery] = useState('')
	const [rooms, setRooms] = useState<Room[]>([])
	const [selectedRoomId, setSelectedRoomId] = useState('')
	const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
	const [tracks, setTracks] = useState<Track[]>([])
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [loadingList, setLoadingList] = useState(true)
	const [loadingTracks, setLoadingTracks] = useState(false)
	const busyRef = useRef(false)
	const tracksVersion = useRef(0)

	const load = useCallback(async () => {
		setLoadingList(true)
		try {
			const [loadedUsers, loadedRooms] = await Promise.all([request('/admin/users'), request('/classes')])

			setUsers(loadedUsers)
			setRooms(loadedRooms)
			setSelectedRoomId((current) =>
				loadedRooms.some((room: Room) => room.id === current) ? current : loadedRooms[0]?.id || '',
			)
		} catch (caught) {
			setError((caught as Error).message)
		} finally {
			setLoadingList(false)
		}
	}, [])

	const loadTracks = useCallback(async (roomId: string, playlistId: string) => {
		const version = ++tracksVersion.current

		if (!roomId || !playlistId) {
			setTracks([])
			setLoadingTracks(false)

			return
		}
		setLoadingTracks(true)
		try {
			const data = await request(`/classes/${roomId}/tracks?playlistId=${encodeURIComponent(playlistId)}`)

			if (version === tracksVersion.current) setTracks(data.tracks)
		} catch (caught) {
			if (version !== tracksVersion.current) return
			const message = (caught as Error).message

			if (message === 'Playlist não encontrada.') setTracks([])
			else setError(message)
		} finally {
			if (version === tracksVersion.current) setLoadingTracks(false)
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])
	useEffect(() => {
		const selectedRoom = rooms.find((room) => room.id === selectedRoomId)

		setSelectedPlaylistId((current) =>
			selectedRoom?.playlists.some((playlist) => playlist.id === current)
				? current
				: selectedRoom?.playlists[0]?.id || '',
		)
	}, [rooms, selectedRoomId])
	useEffect(() => {
		loadTracks(selectedRoomId, selectedPlaylistId)
	}, [loadTracks, selectedPlaylistId, selectedRoomId])
	useEffect(() => {
		if (!message) return
		const timer = setTimeout(() => setMessage(''), feedbackDuration.success)

		return () => clearTimeout(timer)
	}, [message])
	useEffect(() => {
		if (!error) return
		const timer = setTimeout(() => setError(''), feedbackDuration.error)

		return () => clearTimeout(timer)
	}, [error])

	async function mutate(work: () => Promise<unknown>, success: string) {
		if (busyRef.current) return false
		busyRef.current = true
		setBusy(true)
		try {
			setError('')
			await work()
			await Promise.all([load(), onChanged()])
			if (selectedRoomId && selectedPlaylistId) await loadTracks(selectedRoomId, selectedPlaylistId)
			setMessage(success)

			return true
		} catch (caught) {
			setError((caught as Error).message)

			return false
		} finally {
			busyRef.current = false
			setBusy(false)
		}
	}

	const managers = users.filter((user) => user.role !== 'STUDENT')
	const normalizedUserQuery = userQuery.trim().toLocaleLowerCase('pt-BR')
	const filteredUsers = users.filter((user) =>
		[
			user.name,
			user.email || '',
			user.role,
			{ ADMIN: 'Administrador', TEACHER: 'Professor', STUDENT: 'Aluno' }[user.role],
		].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedUserQuery)),
	)
	const selectedRoom = rooms.find((room) => room.id === selectedRoomId)

	return (
		<section className="adminPage" aria-busy={busy}>
			<FeedbackToast
				error={error}
				message={message}
				onCloseError={() => setError('')}
				onCloseMessage={() => setMessage('')}
			/>
			<div className="sectionHead">
				<div>
					<span className="eyebrow">ADMINISTRAÇÃO</span>
					<h2>Controle completo do sistema</h2>
				</div>
				<button className="secondary" onClick={load} disabled={busy}>
					<RefreshCw size={17} /> Atualizar
				</button>
			</div>
			{busy && (
				<p className="workingStatus" role="status">
					Salvando alterações...
				</p>
			)}
			{loadingList && (
				<p className="workingStatus" role="status">
					Carregando usuários e turmas...
				</p>
			)}

			<div className="panel adminPanel" inert={busy}>
				<h2>Usuários</h2>
				<p>Cadastre o e-mail Google. A conta será vinculada automaticamente no primeiro login.</p>
				<form
					className="adminCreate"
					onSubmit={(event) => {
						event.preventDefault()
						const form = event.currentTarget
						const data = new FormData(form)

						mutate(
							() =>
								request('/admin/users', {
									method: 'POST',
									body: JSON.stringify({
										name: data.get('name'),
										email: data.get('email'),
										role: data.get('role'),
									}),
								}),
							'Usuário criado.',
						).then((ok) => {
							if (ok) form.reset()
						})
					}}
				>
					<input name="name" placeholder="Nome" required />
					<input name="email" type="email" placeholder="E-mail Google" required />
					<RoleSelect name="role" />
					<button className="primary">
						<Plus size={17} /> Criar
					</button>
				</form>
				<label className="adminSearch">
					<span>Buscar usuários</span>
					<input
						type="search"
						value={userQuery}
						onChange={(event) => setUserQuery(event.target.value)}
						placeholder="Nome, e-mail ou perfil"
					/>
				</label>
				<p className="adminSearchCount" role="status">
					{filteredUsers.length} de {users.length} usuários
				</p>
				<div className="adminList">
					{filteredUsers.map((item) => (
						<form
							className="adminRow"
							key={item.id}
							onSubmit={(event) => {
								event.preventDefault()
								const data = new FormData(event.currentTarget)

								mutate(
									() =>
										request('/admin/users', {
											method: 'PATCH',
											body: JSON.stringify({
												userId: item.id,
												name: data.get('name'),
												email: data.get('email') || null,
												role: data.get('role'),
												blocked: data.get('blocked') === 'on',
											}),
										}),
									'Usuário atualizado.',
								)
							}}
						>
							<input name="name" defaultValue={item.name} aria-label="Nome" required />
							<input name="email" type="email" defaultValue={item.email || ''} aria-label="E-mail" />
							<RoleSelect name="role" value={item.role} />
							<label className="inlineCheck">
								<input name="blocked" type="checkbox" defaultChecked={item.blocked} /> Bloqueado
							</label>
							<button className="iconButton" title="Salvar">
								<Save size={17} />
							</button>
							<button
								className="iconButton danger"
								type="button"
								title="Excluir"
								onClick={() => {
									if (confirm(`Excluir ${item.name} e seus dados?`))
										mutate(
											() =>
												request('/admin/users', {
													method: 'DELETE',
													body: JSON.stringify({ userId: item.id }),
												}),
											'Usuário excluído.',
										)
								}}
							>
								<Trash2 size={17} />
							</button>
						</form>
					))}
				</div>
			</div>

			<div className="panel adminPanel" inert={busy}>
				<h2>Turmas</h2>
				<form
					className="adminCreate"
					onSubmit={(event) => {
						event.preventDefault()
						const form = event.currentTarget
						const data = new FormData(form)

						mutate(
							() =>
								request('/classes', {
									method: 'POST',
									body: JSON.stringify({
										name: data.get('name'),
										teacherIds: data.getAll('teacherIds'),
									}),
								}),
							'Turma criada.',
						).then((ok) => {
							if (ok) form.reset()
						})
					}}
				>
					<input name="name" placeholder="Nome da turma" required />
					<TeacherSelector users={managers} />
					<button className="primary">
						<Plus size={17} /> Criar
					</button>
				</form>
				<div className="adminList">
					{rooms.map((item) => (
						<form
							className="adminRow roomAdminRow"
							key={item.id}
							onSubmit={(event) => {
								event.preventDefault()
								const data = new FormData(event.currentTarget)

								mutate(
									() =>
										request(`/classes/${item.id}`, {
											method: 'PATCH',
											body: JSON.stringify({
												name: data.get('name'),
												teacherIds: data.getAll('teacherIds'),
											}),
										}),
									'Turma atualizada.',
								)
							}}
						>
							<input name="name" defaultValue={item.name} aria-label="Nome da turma" required />
							<TeacherSelector users={managers} values={item.teacherIds} />
							<code>{item.code}</code>
							<button className="iconButton" title="Salvar">
								<Save size={17} />
							</button>
							<button
								className="iconButton danger"
								type="button"
								title="Excluir"
								onClick={() => {
									if (confirm(`Excluir a turma ${item.name} e toda a playlist?`))
										mutate(
											() => request(`/classes/${item.id}`, { method: 'DELETE' }),
											'Turma excluída.',
										)
								}}
							>
								<Trash2 size={17} />
							</button>
						</form>
					))}
				</div>
			</div>

			<div className="panel adminPanel" inert={busy}>
				<h2>Playlists</h2>
				{loadingTracks && (
					<p className="workingStatus" role="status">
						Carregando músicas...
					</p>
				)}
				<select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
					{rooms.map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</select>
				{selectedRoom && (
					<>
						<form
							className="adminCreate playlistCreate"
							onSubmit={(event) => {
								event.preventDefault()
								const form = event.currentTarget
								const data = new FormData(form)

								mutate(
									() =>
										request(`/classes/${selectedRoomId}/playlists`, {
											method: 'POST',
											body: data,
										}),
									'Playlist criada.',
								).then((ok) => {
									if (ok) form.reset()
								})
							}}
						>
							<input name="name" placeholder="Nome da nova playlist" required />
							<label className="playlistCoverInput">
								Capa opcional
								<input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
							</label>
							<button className="primary">
								<Plus size={17} /> Criar playlist
							</button>
						</form>
						<div className="playlistTabs">
							{selectedRoom.playlists.map((playlist) => (
								<button
									key={playlist.id}
									className={playlist.id === selectedPlaylistId ? 'active' : ''}
									onClick={() => setSelectedPlaylistId(playlist.id)}
								>
									{playlist.coverUrl && (
										<Image src={playlist.coverUrl} alt="" width={24} height={24} unoptimized />
									)}
									{playlist.name}
								</button>
							))}
						</div>
						{selectedRoom.playlists
							.filter((playlist) => playlist.id === selectedPlaylistId)
							.map((playlist) => (
								<form
									className="playlistEdit"
									key={playlist.id}
									onSubmit={(event) => {
										event.preventDefault()
										const data = new FormData(event.currentTarget)

										mutate(
											() =>
												request(`/classes/${selectedRoomId}/playlists/${playlist.id}`, {
													method: 'PATCH',
													body: data,
												}),
											'Playlist atualizada.',
										)
									}}
								>
									<input name="name" defaultValue={playlist.name} required />
									<div className="playlistCoverField">
										<div className="playlistCoverPreview">
											{playlist.coverUrl ? (
												<Image
													src={playlist.coverUrl}
													alt=""
													width={52}
													height={52}
													unoptimized
												/>
											) : (
												<Music2 size={23} />
											)}
										</div>
										<label className="playlistCoverInput">
											Trocar capa (JPG, PNG, WebP ou GIF; até 2 MB)
											<input
												name="cover"
												type="file"
												accept="image/jpeg,image/png,image/webp,image/gif"
											/>
										</label>
										{playlist.coverUrl && (
											<label className="removeCover">
												<input name="removeCover" type="checkbox" /> Remover capa
											</label>
										)}
									</div>
									<button className="iconButton" title="Salvar">
										<Save size={17} />
									</button>
									<button
										className="iconButton danger"
										type="button"
										disabled={selectedRoom.playlists.length === 1}
										onClick={() => {
											if (confirm(`Excluir a playlist ${playlist.name} e suas músicas?`))
												mutate(
													() =>
														request(`/classes/${selectedRoomId}/playlists/${playlist.id}`, {
															method: 'DELETE',
														}),
													'Playlist excluída.',
												)
										}}
									>
										<Trash2 size={17} />
									</button>
								</form>
							))}
					</>
				)}
				{selectedPlaylistId && (
					<form
						className="adminCreate trackCreate"
						onSubmit={(event) => {
							event.preventDefault()
							const form = event.currentTarget
							const data = new FormData(form)

							mutate(
								() =>
									request(`/classes/${selectedRoomId}/tracks`, {
										method: 'POST',
										body: JSON.stringify({
											url: data.get('url'),
											title: data.get('title'),
											artist: data.get('artist'),
											playlistId: selectedPlaylistId,
										}),
									}),
								'Música adicionada.',
							).then((ok) => {
								if (ok) form.reset()
							})
						}}
					>
						<input name="url" placeholder="Link do YouTube ou YouTube Music" required />
						<input name="title" placeholder="Título" required />
						<input name="artist" placeholder="Artista" />
						<button className="primary">
							<Plus size={17} /> Adicionar
						</button>
					</form>
				)}
				<div className="adminList">
					{tracks.map((track) => (
						<form
							className="adminRow trackAdminRow"
							key={track.id}
							onSubmit={(event) => {
								event.preventDefault()
								const data = new FormData(event.currentTarget)

								mutate(
									() =>
										request(`/classes/${selectedRoomId}/tracks`, {
											method: 'PATCH',
											body: JSON.stringify({
												suggestionId: track.id,
												title: data.get('title'),
												artist: data.get('artist'),
												status: data.get('status'),
											}),
										}),
									'Música atualizada.',
								)
							}}
						>
							<input name="title" defaultValue={track.title} aria-label="Título" required />
							<input name="artist" defaultValue={track.artist} aria-label="Artista" required />
							<select name="status" defaultValue={track.status} aria-label="Status">
								<option value="PENDING">Pendente</option>
								<option value="APPROVED">Aprovada</option>
								<option value="REJECTED">Recusada</option>
							</select>
							<button className="iconButton" title="Salvar">
								<Save size={17} />
							</button>
							<button
								className="iconButton danger"
								type="button"
								title="Excluir"
								onClick={() => {
									if (confirm(`Remover ${track.title} da playlist?`))
										mutate(
											() =>
												request(`/classes/${selectedRoomId}/tracks`, {
													method: 'DELETE',
													body: JSON.stringify({ suggestionId: track.id }),
												}),
											'Música removida.',
										)
								}}
							>
								<Trash2 size={17} />
							</button>
						</form>
					))}
				</div>
			</div>
		</section>
	)
}

function RoleSelect({ name, value = 'STUDENT' }: { name: string; value?: Role }) {
	return (
		<select name={name} defaultValue={value}>
			<option value="STUDENT">Aluno</option>
			<option value="TEACHER">Professor</option>
			<option value="ADMIN">Administrador</option>
		</select>
	)
}

function TeacherSelector({ users, values = [] }: { users: AdminUser[]; values?: string[] }) {
	return (
		<fieldset className="teacherSelector">
			<legend>Professores</legend>
			{users.map((user) => (
				<label key={user.id}>
					<input
						name="teacherIds"
						type="checkbox"
						value={user.id}
						defaultChecked={values.includes(user.id)}
					/>
					{user.name}
				</label>
			))}
		</fieldset>
	)
}
