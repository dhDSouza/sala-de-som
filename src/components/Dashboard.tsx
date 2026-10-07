'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Music2,
	Plus,
	ThumbsUp,
	Users,
	Settings,
	LogOut,
	Play,
	Pause,
	SkipForward,
	SkipBack,
	Disc3,
	ShieldCheck,
	Copy,
	CircleUserRound,
	ExternalLink,
	Search,
	GraduationCap,
	ListMusic,
	Headphones,
	PanelLeftClose,
	PanelLeftOpen,
	Trash2,
	Pencil,
} from 'lucide-react'
import AdminPanel from '@/components/AdminPanel'
import ProfilePanel from '@/components/ProfilePanel'
import AuthScreen from '@/components/AuthScreen'
import { feedbackDuration } from '@/lib/feedback'
import FeedbackToast from '@/components/FeedbackToast'

type User = {
	id: string
	name: string
	email: string | null
	avatar: string | null
	role: 'ADMIN' | 'TEACHER' | 'STUDENT'
}
type Playlist = { id: string; classId: string; name: string; coverUrl: string | null }
type Room = {
	id: string
	name: string
	code: string
	rules: string
	ownerId: string
	requireApproval: boolean
	maxSuggestions: number
	teacherIds: string[]
	playlists: Playlist[]
}
type Track = {
	id: string
	youtubeVideoId: string
	title: string
	artist: string
	artwork: string | null
	status: string
	votes: number
	voted: boolean
	suggestedBy: string
	suggestedAvatar: string | null
	playedAt: string | null
}
type DashboardView = 'playlist' | 'ranking' | 'settings' | 'admin' | 'profile' | 'createClass'
type YTPlayer = {
	loadVideoById: (id: string) => void
	playVideo: () => void
	pauseVideo: () => void
	stopVideo: () => void
	getPlayerState: () => number
	destroy: () => void
}
let youtubeApiPromise: Promise<void> | null = null

function loadYouTubeApi() {
	if (window.YT?.Player) return Promise.resolve()
	if (youtubeApiPromise) return youtubeApiPromise

	youtubeApiPromise = new Promise<void>((resolve, reject) => {
		window.onYouTubeIframeAPIReady = resolve
		const script = document.createElement('script')

		script.src = 'https://www.youtube.com/iframe_api'
		script.onerror = () => {
			youtubeApiPromise = null
			script.remove()
			reject(Error('Não foi possível carregar o player.'))
		}
		document.body.appendChild(script)
	})

	return youtubeApiPromise
}

declare global {
	interface Window {
		YT: {
			Player: new (
				id: string,
				options: {
					width: string
					height: string
					videoId?: string
					playerVars: { playsinline: number; origin: string }
					events: {
						onReady: () => void
						onStateChange: (event: { data: number }) => void
						onError: () => void
					}
				},
			) => YTPlayer
		}
		onYouTubeIframeAPIReady: () => void
	}
}

async function api(path: string, options?: RequestInit) {
	const response = await fetch('/api' + path, {
		cache: 'no-store',
		...options,
		headers:
			options?.body instanceof FormData
				? options?.headers
				: { 'Content-Type': 'application/json', ...options?.headers },
	})
	const data = await response.json()

	if (!response.ok) throw Object.assign(new Error(data.error || 'Falha na solicitação'), { status: response.status })

	return data
}

export default function Dashboard() {
	const [user, setUser] = useState<User | null>(null),
		[classes, setClasses] = useState<Room[]>([]),
		[room, setRoom] = useState<Room | null>(null),
		[selectedPlaylistId, setSelectedPlaylistId] = useState(''),
		[tracks, setTracks] = useState<Track[]>([]),
		[videoUrl, setVideoUrl] = useState(''),
		[videoTitle, setVideoTitle] = useState(''),
		[videoArtist, setVideoArtist] = useState(''),
		[filter, setFilter] = useState(''),
		[view, setView] = useState<DashboardView>('playlist'),
		[sortMode, setSortMode] = useState<'original' | 'popular'>('original'),
		[error, setError] = useState(''),
		[notice, setNotice] = useState(''),
		[loading, setLoading] = useState(true),
		[tracksLoading, setTracksLoading] = useState(false),
		[code, setCode] = useState(''),
		[className, setClassName] = useState(''),
		[newPlaylistName, setNewPlaylistName] = useState(''),
		[rules, setRules] = useState(''),
		[playing, setPlaying] = useState(false),
		[current, setCurrent] = useState<Track | null>(null),
		[ready, setReady] = useState(false)
	const [busy, setBusy] = useState(false)
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const player = useRef<YTPlayer | null>(null),
		initialNavigationApplied = useRef(false),
		inviteProcessed = useRef(false),
		queue = useRef<Track[]>([]),
		currentRef = useRef<Track | null>(null),
		busyRef = useRef(false),
		loadVersion = useRef(0)
	const canCreateClass = user?.role === 'ADMIN' || user?.role === 'TEACHER'
	const canManage =
		user?.role === 'ADMIN' ||
		(user?.role === 'TEACHER' && (room?.ownerId === user.id || room?.teacherIds.includes(user.id)))
	const roomId = room?.id
	const playerVisible = Boolean(roomId) && view === 'playlist'
	const refresh = useCallback(async () => {
		try {
			let data = await api('/me')
			let invitedRoomId = ''
			const inviteCode = new URLSearchParams(window.location.search).get('invite')

			if (inviteCode && !inviteProcessed.current) {
				inviteProcessed.current = true
				try {
					const joined: Room = await api('/classes/join', {
						method: 'POST',
						body: JSON.stringify({ code: inviteCode }),
					})

					invitedRoomId = joined.id
					data = await api('/me')
					const url = new URL(window.location.href)

					url.searchParams.delete('invite')
					window.history.replaceState(null, '', url.pathname + url.search + url.hash)
					setNotice('Você entrou na turma pelo convite!')
				} catch (caught) {
					setError((caught as Error).message)
				}
			}

			setUser(data.user)
			setClasses(data.classes)
			if (!initialNavigationApplied.current) {
				initialNavigationApplied.current = true
				const params = new URLSearchParams(window.location.search)
				const initialRoom =
					data.classes.find((item: Room) => item.id === (invitedRoomId || params.get('classId'))) ||
					data.classes[0] ||
					null
				const requestedView = params.get('view')
				const canEditRoom =
					data.user.role === 'ADMIN' ||
					(data.user.role === 'TEACHER' &&
						initialRoom &&
						(initialRoom.ownerId === data.user.id || initialRoom.teacherIds.includes(data.user.id)))

				setRoom(initialRoom)
				if (initialRoom?.playlists.some((playlist: Playlist) => playlist.id === params.get('playlistId')))
					setSelectedPlaylistId(params.get('playlistId') || '')
				if (
					!invitedRoomId &&
					(requestedView === 'ranking' ||
						requestedView === 'profile' ||
						(requestedView === 'admin' && data.user.role === 'ADMIN') ||
						(requestedView === 'createClass' && data.user.role !== 'STUDENT') ||
						(requestedView === 'settings' && canEditRoom))
				)
					setView(requestedView)
			} else
				setRoom(
					(old) =>
						data.classes.find((c: Room) => c.id === (invitedRoomId || old?.id)) || data.classes[0] || null,
				)
		} catch (caught) {
			if ((caught as Error & { status?: number }).status === 401) setUser(null)
			else setError((caught as Error).message)
		} finally {
			setLoading(false)
		}
	}, [])
	const load = useCallback(async (id: string, playlistId?: string, foreground = false) => {
		const version = ++loadVersion.current

		if (foreground) {
			setTracksLoading(true)
			setTracks([])
		}

		try {
			const query = playlistId ? `?playlistId=${encodeURIComponent(playlistId)}` : ''
			const data = await api(`/classes/${id}/tracks${query}`)

			if (version !== loadVersion.current) return

			setTracks(data.tracks)
			setRoom(data.room)
			setSelectedPlaylistId(data.playlist.id)
			setRules(data.room.rules)
		} catch (e) {
			if (playlistId) {
				try {
					const data = await api(`/classes/${id}/tracks`)

					if (version !== loadVersion.current) return

					setTracks(data.tracks)
					setRoom(data.room)
					setSelectedPlaylistId(data.playlist.id)
					setRules(data.room.rules)

					return
				} catch (fallbackError) {
					if (version === loadVersion.current) setError((fallbackError as Error).message)

					return
				}
			}
			if (version === loadVersion.current) setError((e as Error).message)
		} finally {
			if (version === loadVersion.current) setTracksLoading(false)
		}
	}, [])

	useEffect(() => {
		refresh()
	}, [refresh])
	useEffect(() => {
		if (roomId) load(roomId, selectedPlaylistId, true)
	}, [roomId, selectedPlaylistId, load])
	useEffect(() => {
		if (!roomId) {
			loadVersion.current += 1
			setTracks([])
			setSelectedPlaylistId('')
		}
	}, [roomId])
	useEffect(() => {
		if (!roomId) return
		const timer = setInterval(() => {
			if (!busyRef.current) load(roomId, selectedPlaylistId)
		}, 15000)

		return () => clearInterval(timer)
	}, [roomId, selectedPlaylistId, load])
	useEffect(() => {
		const approvedTracks = tracks.filter((t) => t.status === 'APPROVED')

		queue.current = sortMode === 'popular' ? [...approvedTracks].sort((a, b) => b.votes - a.votes) : approvedTracks
		const active = currentRef.current

		if (active) {
			const updated = tracks.find((track) => track.id === active.id && track.status === 'APPROVED')

			if (!updated) {
				currentRef.current = null
				setCurrent(null)
				setPlaying(false)
				player.current?.stopVideo?.()
			} else if (updated.title !== active.title || updated.artist !== active.artist) {
				currentRef.current = updated
				setCurrent(updated)
			}
		}
	}, [tracks, sortMode])
	useEffect(() => {
		currentRef.current = null
		setCurrent(null)
		setPlaying(false)
		player.current?.stopVideo?.()
	}, [roomId, selectedPlaylistId])
	useEffect(() => {
		if (!notice) return
		const timer = setTimeout(() => setNotice(''), feedbackDuration.success)

		return () => clearTimeout(timer)
	}, [notice])
	useEffect(() => {
		if (!error) return
		const timer = setTimeout(() => setError(''), feedbackDuration.error)

		return () => clearTimeout(timer)
	}, [error])

	async function action(fn: () => Promise<unknown>, message: string) {
		if (busyRef.current) return false
		busyRef.current = true
		setBusy(true)
		try {
			setError('')
			await fn()
			await Promise.all([refresh(), room ? load(room.id, selectedPlaylistId) : Promise.resolve()])
			setNotice(message)

			return true
		} catch (e) {
			setError((e as Error).message)

			return false
		} finally {
			busyRef.current = false
			setBusy(false)
		}
	}

	async function createClass(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (busyRef.current) return
		busyRef.current = true
		setBusy(true)
		setError('')
		try {
			const created: Room = await api('/classes', {
				method: 'POST',
				body: JSON.stringify({ name: className }),
			})

			await refresh()
			setRoom(created)
			setSelectedPlaylistId('')
			setClassName('')
			setView('settings')
			setNotice('Turma criada! Agora você pode adicionar playlists.')
		} catch (caught) {
			setError((caught as Error).message)
		} finally {
			busyRef.current = false
			setBusy(false)
		}
	}

	function startTrack(track: Track) {
		const activePlayer = player.current

		if (!ready || typeof activePlayer?.loadVideoById !== 'function') {
			setError('Aguarde o player carregar.')

			return
		}

		currentRef.current = track
		setCurrent(track)
		activePlayer.loadVideoById(track.youtubeVideoId)
		setPlaying(true)
	}

	function next() {
		const index = queue.current.findIndex((t) => t.id === currentRef.current?.id)
		const following = queue.current[index + 1]

		if (following) {
			const activePlayer = player.current

			if (typeof activePlayer?.loadVideoById !== 'function') return
			currentRef.current = following
			setCurrent(following)
			activePlayer.loadVideoById(following.youtubeVideoId)
			setPlaying(true)
		} else {
			currentRef.current = null
			setCurrent(null)
			setPlaying(false)
			player.current?.stopVideo?.()
		}
	}

	function previous() {
		const index = queue.current.findIndex((track) => track.id === currentRef.current?.id)

		if (index > 0) startTrack(queue.current[index - 1])
	}

	useEffect(() => {
		if (!playerVisible) return
		let cancelled = false

		async function init() {
			await loadYouTubeApi()
			if (cancelled) return
			player.current = new window.YT.Player('youtube-player', {
				width: '100%',
				height: '100%',
				playerVars: { playsinline: 1, origin: location.origin },
				events: {
					onReady: () => {
						if (!cancelled) setReady(true)
					},
					onStateChange: (e) => {
						if (cancelled) return
						setPlaying(e.data === 1)
						if (e.data === 0 && currentRef.current) next()
					},
					onError: () => {
						if (!cancelled) setError('Este vídeo não pode ser reproduzido aqui. Escolha outro.')
					},
				},
			})
		}

		init().catch((e) => {
			if (!cancelled) setError(e.message)
		})

		return () => {
			cancelled = true
			player.current?.destroy?.()
			player.current = null
			setReady(false)
		}
	}, [playerVisible])
	if (loading)
		return (
			<main className="center">
				<Disc3 className="spin" />
				<p>Carregando a sala...</p>
			</main>
		)
	if (!user) return <AuthScreen onAuthenticated={refresh} />
	const approved = tracks.filter((t) => t.status === 'APPROVED'),
		pending = tracks.filter((t) => t.status === 'PENDING')
	const sortedApproved = sortMode === 'popular' ? [...approved].sort((a, b) => b.votes - a.votes) : approved
	const currentQueueIndex = sortedApproved.findIndex((track) => track.id === current?.id)
	const filteredApproved = sortedApproved.filter((track) =>
		`${track.title} ${track.artist} ${track.suggestedBy}`
			.toLocaleLowerCase('pt-BR')
			.includes(filter.toLocaleLowerCase('pt-BR')),
	)
	const topVoted = [...approved].sort((a, b) => b.votes - a.votes).slice(0, 3)
	const selectedPlaylist =
		room?.playlists.find((playlist) => playlist.id === selectedPlaylistId) || room?.playlists[0]
	const inviteUrl = room && typeof window !== 'undefined' ? `${window.location.origin}/?invite=${room.code}` : ''
	const studentRanks = Object.entries(
		approved.reduce<Record<string, number>>((acc, t) => {
			acc[t.suggestedBy] = (acc[t.suggestedBy] || 0) + t.votes

			return acc
		}, {}),
	).sort((a, b) => b[1] - a[1])
	const navHref = (destination: DashboardView) => {
		const params = new URLSearchParams({ view: destination })

		if (room) params.set('classId', room.id)
		if (selectedPlaylistId) params.set('playlistId', selectedPlaylistId)

		return `/?${params.toString()}`
	}

	return (
		<div className={`appShell${sidebarCollapsed ? ' sidebarCollapsed' : ''}`}>
			<header className="globalHeader">
				<button
					className="sidebarToggle"
					type="button"
					onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
					aria-label={sidebarCollapsed ? 'Expandir menu de navegação' : 'Recolher menu de navegação'}
					aria-expanded={!sidebarCollapsed}
					title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
				>
					{sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
				</button>
				<div className="headerBrand">
					<span className="headerBrandIcon">
						<Music2 size={27} />
					</span>
					<span>
						Sala de Som<small>PLAYLIST DA TURMA</small>
					</span>
				</div>
				<label className="headerSearch">
					<Search size={19} />
					<input
						type="search"
						value={filter}
						onChange={(event) => {
							setFilter(event.target.value)
							setView('playlist')
						}}
						placeholder="Filtrar músicas da playlist..."
						aria-label="Filtrar músicas da playlist"
					/>
				</label>
				<label className="headerClassSelect">
					<GraduationCap size={19} />
					<select
						aria-label="Selecionar turma"
						value={room?.id || ''}
						onChange={(event) => {
							setRoom(classes.find((item) => item.id === event.target.value) || null)
							setSelectedPlaylistId('')
							setFilter('')
							setView('playlist')
						}}
					>
						{classes.length ? (
							classes.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name}
								</option>
							))
						) : (
							<option value="">Nenhuma turma</option>
						)}
					</select>
				</label>
				<button className="headerProfile" onClick={() => setView('profile')}>
					<span className="headerAvatar">
						{user.avatar ? (
							<Image src={user.avatar} alt="" width={39} height={39} unoptimized />
						) : (
							user.name[0]
						)}
					</span>
					<span>
						<strong>{user.name}</strong>
						<small>{user.email || 'Meu perfil'}</small>
					</span>
				</button>
			</header>
			<aside className="sidebar">
				<div className="brand">
					<div className="brandMark">
						<Music2 size={24} />
					</div>
					<b>
						SALA<span>DE</span>SOM
					</b>
				</div>
				<div className="sideLabel">NAVEGAÇÃO</div>
				<nav>
					<a
						className={view === 'playlist' ? 'active' : ''}
						href={navHref('playlist')}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Playlists, abre em nova aba"
						title="Playlists (abrir em nova aba)"
					>
						<ListMusic size={19} /> <span>Playlists</span>
					</a>
					<a
						className={view === 'ranking' ? 'active' : ''}
						href={navHref('ranking')}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Ranking, abre em nova aba"
						title="Ranking (abrir em nova aba)"
					>
						<ThumbsUp size={19} /> <span>Ranking</span>
					</a>
					<a
						className={view === 'profile' ? 'active' : ''}
						href={navHref('profile')}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Meu perfil, abre em nova aba"
						title="Meu perfil (abrir em nova aba)"
					>
						<CircleUserRound size={19} /> <span>Meu perfil</span>
					</a>
					{canManage && (
						<a
							className={view === 'settings' ? 'active' : ''}
							href={navHref('settings')}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Configurações, abre em nova aba"
							title="Configurações (abrir em nova aba)"
						>
							<Settings size={19} /> <span>Configurações</span>
						</a>
					)}
					{canCreateClass && (
						<a
							className={view === 'createClass' ? 'active' : ''}
							href={navHref('createClass')}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Nova turma, abre em nova aba"
							title="Nova turma (abrir em nova aba)"
						>
							<Plus size={19} /> <span>Nova turma</span>
						</a>
					)}
					{user.role === 'ADMIN' && (
						<a
							className={view === 'admin' ? 'active' : ''}
							href={navHref('admin')}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Administração, abre em nova aba"
							title="Administração (abrir em nova aba)"
						>
							<ShieldCheck size={19} /> <span>Administração</span>
						</a>
					)}
				</nav>
				<div className="sidebarPromo">
					<Headphones size={27} />
					<strong>O som da sua turma.</strong>
					<span>Descubra, vote e ouça as músicas que todo mundo escolheu.</span>
				</div>
				<div className="sideBottom">
					<div className="user">
						<div className="avatar">
							{user.avatar ? (
								<Image src={user.avatar} alt="" width={36} height={36} unoptimized />
							) : (
								user.name[0]
							)}
						</div>
						<div className="userDetails">
							<strong>{user.name}</strong>
							<small>
								{user.role === 'ADMIN'
									? 'Administrador'
									: user.role === 'TEACHER'
										? 'Professor'
										: 'Aluno'}
							</small>
						</div>
					</div>
					<button
						className="logout"
						title="Sair"
						onClick={async () => {
							try {
								await api('/auth/logout', { method: 'POST' })
								player.current?.destroy?.()
								player.current = null
								setUser(null)
								setClasses([])
								setRoom(null)
								setTracks([])
							} catch (caught) {
								setError((caught as Error).message)
							}
						}}
					>
						<LogOut size={18} />
					</button>
				</div>
			</aside>
			<main className="main" aria-busy={busy}>
				<header className="topbar">
					<div>
						<span className="eyebrow">
							{view === 'profile'
								? 'CONTA E PREFERÊNCIAS'
								: view === 'admin'
									? 'PAINEL ADMINISTRATIVO'
									: view === 'createClass'
										? 'NOVA TURMA'
										: view === 'ranking'
											? 'EM DESTAQUE'
											: view === 'settings'
												? 'GERENCIAR TURMA'
												: 'TURMA ATUAL'}
						</span>
						<h1>
							{view === 'profile'
								? 'Meu perfil'
								: view === 'admin'
									? 'Administração'
									: view === 'createClass'
										? 'Criar turma'
										: room?.name || 'Encontre sua turma'}
						</h1>
						{room && view === 'playlist' && (
							<div className="heroMeta">
								<span>
									Código <strong>{room.code}</strong>
								</span>
								<span>
									<Users size={15} /> {room.teacherIds.length}{' '}
									{room.teacherIds.length === 1 ? 'professor' : 'professores'}
								</span>
								<span>
									<ListMusic size={15} /> {room.playlists.length}{' '}
									{room.playlists.length === 1 ? 'playlist' : 'playlists'}
								</span>
							</div>
						)}
					</div>
					{canManage && room && view === 'playlist' ? (
						<button className="roleTag" onClick={() => setView('settings')}>
							<Settings size={16} /> Gerenciar turma
						</button>
					) : (
						<span className="roleTag">
							<Users size={16} /> {room?.code || 'Sem turma'}
						</span>
					)}
				</header>
				{busy && (
					<p className="workingStatus" role="status">
						Salvando alterações...
					</p>
				)}
				<FeedbackToast
					error={error}
					message={notice}
					onCloseError={() => setError('')}
					onCloseMessage={() => setNotice('')}
				/>
				{view === 'profile' ? (
					<ProfilePanel user={user} onChanged={refresh} />
				) : view === 'admin' && user.role === 'ADMIN' ? (
					<AdminPanel onChanged={refresh} />
				) : view === 'createClass' && canCreateClass ? (
					<section className="settingsGrid" inert={busy}>
						<div className="panel">
							<h2>Nova turma</h2>
							<p>
								Crie uma turma e compartilhe o código com os alunos. Você poderá adicionar playlists em
								seguida.
							</p>
							<form className="compactForm" onSubmit={createClass}>
								<input
									value={className}
									onChange={(event) => setClassName(event.target.value)}
									placeholder="Ex.: TDS 2026 — Turma A"
									minLength={3}
									maxLength={100}
									required
								/>
								<button className="primary" type="submit">
									Criar turma
								</button>
							</form>
						</div>
					</section>
				) : !room ? (
					<section className="empty" inert={busy}>
						<Disc3 size={52} />
						<h2>Entre no ritmo da sua turma</h2>
						<p>Informe o código que seu professor compartilhou.</p>
						<form
							onSubmit={(e) => {
								e.preventDefault()
								action(
									() => api('/classes/join', { method: 'POST', body: JSON.stringify({ code }) }),
									'Você entrou na turma!',
								)
							}}
						>
							<input
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="Código da turma"
								required
							/>
							<button className="primary">Entrar</button>
						</form>
						{canCreateClass && (
							<div className="createBox">
								<p>Ou crie uma turma para começar.</p>
								<form onSubmit={createClass}>
									<input
										value={className}
										onChange={(e) => setClassName(e.target.value)}
										placeholder="Ex.: TIA 2026 — Noite"
										minLength={3}
										maxLength={100}
										required
									/>
									<button className="secondary">Criar turma</button>
								</form>
							</div>
						)}
					</section>
				) : view === 'settings' ? (
					<section className="settingsGrid" inert={busy}>
						<div className="panel">
							<h2>Regras da turma</h2>
							<p>
								A revisão de letras e temas deve ser feita pelo professor: o YouTube não fornece um
								marcador confiável de conteúdo explícito.
							</p>
							<textarea
								value={rules}
								onChange={(e) => setRules(e.target.value)}
								rows={5}
								placeholder="Ex.: sugestões adequadas ao ambiente da sala..."
							/>
							<div className="checkRow">
								<label>
									<input
										type="checkbox"
										checked={room.requireApproval}
										onChange={(e) => setRoom({ ...room, requireApproval: e.target.checked })}
									/>{' '}
									Aprovar antes de incluir
								</label>
							</div>
							<div className="checkRow">
								<label>
									<input
										type="checkbox"
										checked={room.maxSuggestions === 0}
										onChange={(e) => setRoom({ ...room, maxSuggestions: e.target.checked ? 0 : 5 })}
									/>{' '}
									Sem limite de sugestões por aluno
								</label>
							</div>
							{room.maxSuggestions > 0 && (
								<label className="fieldLabel">
									Sugestões por aluno
									<input
										type="number"
										min="1"
										max="30"
										value={room.maxSuggestions}
										onChange={(e) => setRoom({ ...room, maxSuggestions: Number(e.target.value) })}
									/>
								</label>
							)}
							<button
								className="primary"
								onClick={() =>
									action(
										() =>
											api(`/classes/${room.id}/moderate`, {
												method: 'PATCH',
												body: JSON.stringify({
													action: 'rules',
													rules,
													requireApproval: room.requireApproval,
													maxSuggestions: room.maxSuggestions,
												}),
											}),
										'Regras atualizadas.',
									)
								}
							>
								Salvar regras
							</button>
						</div>
						<div className="panel">
							<h2>Convite</h2>
							<p>
								Compartilhe o link. Quem ainda não tem conta poderá se cadastrar antes de entrar na
								turma.
							</p>
							<div className="inviteLink">
								<a href={inviteUrl} target="_blank" rel="noopener noreferrer">
									{inviteUrl}
								</a>
								<button
									type="button"
									className="secondary"
									onClick={() =>
										navigator.clipboard
											.writeText(inviteUrl)
											.then(() => setNotice('Link do convite copiado!'))
											.catch(() =>
												setError('Não foi possível copiar o link. Copie-o manualmente.'),
											)
									}
								>
									<Copy size={17} /> Copiar link
								</button>
							</div>
							<p>Também é possível entrar com o código:</p>
							<div className="invite">
								<span>Código da turma</span>
								<strong>{room.code}</strong>
								<button
									onClick={() =>
										navigator.clipboard
											.writeText(room.code)
											.then(() => setNotice('Código copiado!'))
									}
								>
									<Copy size={17} />
								</button>
							</div>
						</div>
						<div className="panel">
							<h2>Playlists da turma</h2>
							<p>Crie listas diferentes para atividades, temas ou momentos da aula.</p>
							<form
								className="compactForm"
								onSubmit={(event) => {
									event.preventDefault()
									const form = event.currentTarget
									const data = new FormData(form)

									action(
										() =>
											api(`/classes/${room.id}/playlists`, {
												method: 'POST',
												body: data,
											}),
										'Playlist criada.',
									).then((ok) => {
										if (ok) {
											setNewPlaylistName('')
											form.reset()
										}
									})
								}}
							>
								<input
									name="name"
									value={newPlaylistName}
									onChange={(event) => setNewPlaylistName(event.target.value)}
									placeholder="Nome da nova playlist"
									required
								/>
								<label className="playlistCoverInput">
									Capa opcional
									<input
										name="cover"
										type="file"
										accept="image/jpeg,image/png,image/webp,image/gif"
									/>
								</label>
								<button className="primary">Criar</button>
							</form>
							<div className="playlistSettings">
								{room.playlists.map((playlist) => (
									<form
										key={playlist.id}
										onSubmit={(event) => {
											event.preventDefault()
											const data = new FormData(event.currentTarget)

											action(
												() =>
													api(`/classes/${room.id}/playlists/${playlist.id}`, {
														method: 'PATCH',
														body: data,
													}),
												'Playlist atualizada.',
											)
										}}
									>
										<input
											name="name"
											defaultValue={playlist.name}
											aria-label="Nome da playlist"
											required
										/>
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
										<button className="approve">Salvar</button>
										<button
											className="reject"
											type="button"
											disabled={room.playlists.length === 1}
											onClick={() => {
												if (confirm(`Excluir a playlist ${playlist.name} e todas as músicas?`))
													action(
														() =>
															api(`/classes/${room.id}/playlists/${playlist.id}`, {
																method: 'DELETE',
															}),
														'Playlist excluída.',
													)
											}}
										>
											Excluir
										</button>
									</form>
								))}
							</div>
						</div>
					</section>
				) : view === 'ranking' ? (
					<section className="rankingGrid" inert={busy}>
						<div className="panel">
							<h2>Músicas mais votadas</h2>
							{approved.length ? (
								approved.map((t, i) => (
									<div className="rankRow" key={t.id}>
										<b>{String(i + 1).padStart(2, '0')}</b>
										<Cover track={t} />
										<div>
											<strong>{t.title}</strong>
											<small>{t.artist}</small>
										</div>
										<span>{t.votes} votos</span>
									</div>
								))
							) : (
								<p>Ainda não há votos.</p>
							)}
						</div>
						<div className="panel">
							<h2>DJs da turma</h2>
							<p>Somatório dos votos nas sugestões de cada pessoa.</p>
							{studentRanks.map(([name, votes], i) => (
								<div className="rankRow" key={name}>
									<b>{String(i + 1).padStart(2, '0')}</b>
									<div className="miniAvatar">{name[0]}</div>
									<strong>{name}</strong>
									<span>{votes} votos</span>
								</div>
							))}
						</div>
					</section>
				) : (
					<div className="contentGrid" inert={busy}>
						<div className="primaryColumn">
							{tracksLoading && (
								<p className="workingStatus" role="status">
									Carregando playlist...
								</p>
							)}
							<section className="searchPanel">
								<div className="searchTitle">
									<div>
										<span className="eyebrow">MONTE A PLAYLIST</span>
										<h2>Que música toca agora?</h2>
									</div>
									<span>{approved.length} músicas</span>
								</div>
								<form
									className="linkForm"
									onSubmit={(e) => {
										e.preventDefault()
										action(
											() =>
												api(`/classes/${room.id}/tracks`, {
													method: 'POST',
													body: JSON.stringify({
														url: videoUrl,
														title: videoTitle,
														artist: videoArtist,
														playlistId: selectedPlaylistId,
													}),
												}),
											'Música sugerida!',
										).then((ok) => {
											if (ok) {
												setVideoUrl('')
												setVideoTitle('')
												setVideoArtist('')
											}
										})
									}}
								>
									<input
										aria-label="Link do vídeo"
										value={videoUrl}
										onChange={(e) => setVideoUrl(e.target.value)}
										placeholder="Link do YouTube ou YouTube Music"
										required
									/>
									<input
										aria-label="Título da música"
										value={videoTitle}
										onChange={(e) => setVideoTitle(e.target.value)}
										placeholder="Título da música"
										required
									/>
									<input
										aria-label="Artista"
										value={videoArtist}
										onChange={(e) => setVideoArtist(e.target.value)}
										placeholder="Artista (opcional)"
									/>
									<button className="searchButton" type="submit">
										<Plus size={18} /> Adicionar
									</button>
								</form>
							</section>
							<section className="trackSection">
								<div className="sectionHead">
									<div>
										<span className="eyebrow">FEITA POR TODO MUNDO</span>
										<h2>
											<span className="playlistCoverPreview playlistCoverLarge">
												{selectedPlaylist?.coverUrl ? (
													<Image
														src={selectedPlaylist.coverUrl}
														alt=""
														width={54}
														height={54}
														unoptimized
													/>
												) : (
													<Music2 size={25} />
												)}
											</span>
											{selectedPlaylist?.name || 'Playlist da Turma'}
										</h2>
										<p>Uma seleção colaborativa para ouvir quando quiser.</p>
									</div>
									<div className="playlistActions">
										<button
											className="primary"
											type="button"
											disabled={!approved.length || !ready}
											onClick={() => startTrack(sortedApproved[0])}
										>
											<Play size={16} /> Reproduzir tudo
										</button>
										{canManage && (
											<button
												className="secondary"
												type="button"
												onClick={() => setView('settings')}
											>
												<Plus size={16} /> Nova playlist
											</button>
										)}
									</div>
								</div>
								<label className="playlistPicker">
									Playlist
									<select
										value={selectedPlaylistId}
										onChange={(event) => setSelectedPlaylistId(event.target.value)}
									>
										{room.playlists.map((playlist) => (
											<option key={playlist.id} value={playlist.id}>
												{playlist.name}
											</option>
										))}
									</select>
									<span>{approved.length} músicas aprovadas</span>
								</label>
								<label className="trackSort">
									Ordem de reprodução
									<select
										value={sortMode}
										onChange={(event) => setSortMode(event.target.value as 'original' | 'popular')}
									>
										<option value="original">Ordem de inclusão</option>
										<option value="popular">Mais curtidas</option>
									</select>
								</label>
								{filteredApproved.length ? (
									filteredApproved.map((t, i) => (
										<div className="trackRow" key={t.id}>
											<span className="index">{String(i + 1).padStart(2, '0')}</span>
											<Cover track={t} />
											<div className="trackInfo">
												<strong>{t.title}</strong>
												<small>
													{t.artist}{' '}
													<span className="suggestedBy">
														· sugerida por <SuggesterAvatar track={t} /> {t.suggestedBy}
													</span>
												</small>
											</div>
											<button
												className={'vote ' + (t.voted ? 'voted' : '')}
												onClick={() =>
													action(
														() =>
															api(`/classes/${room.id}/vote`, {
																method: 'POST',
																body: JSON.stringify({ suggestionId: t.id }),
															}),
														'Voto atualizado.',
													)
												}
											>
												<ThumbsUp size={17} />
												{t.votes}
											</button>
											<button
												className="playTrack"
												title={`Tocar ${t.title}`}
												aria-label={`Tocar ${t.title}`}
												onClick={() => startTrack(t)}
											>
												<Play size={18} />
											</button>
											<a
												className="externalTrack"
												href={`https://www.youtube.com/watch?v=${t.youtubeVideoId}`}
												target="_blank"
												rel="noopener noreferrer"
												aria-label={`Abrir ${t.title} no YouTube`}
												title="Abrir no YouTube"
											>
												<ExternalLink size={17} />
											</a>
											{canManage && (
												<>
													<button
														className="externalTrack"
														type="button"
														aria-label={`Editar ${t.title}`}
														title="Editar música"
														onClick={() => {
															const title = prompt('Título da música', t.title)

															if (title === null) return
															const artist = prompt('Artista', t.artist)

															if (artist === null) return
															void action(
																() =>
																	api(`/classes/${room.id}/tracks`, {
																		method: 'PATCH',
																		body: JSON.stringify({
																			suggestionId: t.id,
																			title,
																			artist,
																		}),
																	}),
																'Música atualizada.',
															)
														}}
													>
														<Pencil size={17} />
													</button>
													<button
														className="externalTrack removeTrack"
														type="button"
														aria-label={`Excluir ${t.title}`}
														title="Excluir música"
														onClick={() => {
															if (confirm(`Excluir ${t.title} desta playlist?`))
																void action(
																	() =>
																		api(`/classes/${room.id}/tracks`, {
																			method: 'DELETE',
																			body: JSON.stringify({
																				suggestionId: t.id,
																			}),
																		}),
																	'Música excluída.',
																)
														}}
													>
														<Trash2 size={17} />
													</button>
												</>
											)}
										</div>
									))
								) : (
									<div className="emptyTracks">
										{filter
											? 'Nenhuma música corresponde à busca.'
											: 'A playlist ainda está vazia. Adicione uma música acima.'}
									</div>
								)}
							</section>
							{canManage && pending.length > 0 && (
								<section className="trackSection">
									<div className="sectionHead">
										<h2>Aguardando aprovação</h2>
										<span className="count">{pending.length}</span>
									</div>
									{pending.map((t) => (
										<div className="trackRow" key={t.id}>
											<Cover track={t} />
											<div className="trackInfo">
												<strong>{t.title}</strong>
												<small>
													{t.artist} · <SuggesterAvatar track={t} /> {t.suggestedBy} ·{' '}
													<a
														href={`https://www.youtube.com/watch?v=${t.youtubeVideoId}`}
														target="_blank"
														rel="noopener noreferrer"
													>
														Conferir no YouTube
													</a>
												</small>
											</div>
											<button
												className="approve"
												onClick={() =>
													action(
														() =>
															api(`/classes/${room.id}/moderate`, {
																method: 'PATCH',
																body: JSON.stringify({
																	action: 'approve',
																	suggestionId: t.id,
																}),
															}),
														'Música aprovada.',
													)
												}
											>
												Aprovar
											</button>
											<button
												className="reject"
												onClick={() =>
													action(
														() =>
															api(`/classes/${room.id}/moderate`, {
																method: 'PATCH',
																body: JSON.stringify({
																	action: 'reject',
																	suggestionId: t.id,
																}),
															}),
														'Sugestão recusada.',
													)
												}
											>
												Recusar
											</button>
											<button
												className="externalTrack removeTrack"
												type="button"
												aria-label={`Excluir ${t.title}`}
												title="Excluir música"
												onClick={() => {
													if (confirm(`Excluir ${t.title} desta playlist?`))
														void action(
															() =>
																api(`/classes/${room.id}/tracks`, {
																	method: 'DELETE',
																	body: JSON.stringify({ suggestionId: t.id }),
																}),
															'Música excluída.',
														)
												}}
											>
												<Trash2 size={17} />
											</button>
										</div>
									))}
								</section>
							)}
						</div>
						<aside className="rightRail">
							<div className="nowCard">
								<span className="eyebrow">PLAYER · YOUTUBE</span>
								<div className="youtubeFrame">
									<div id="youtube-player" />
								</div>
								<h2>{current?.title || 'Aguardando o primeiro play'}</h2>
								<p>{current?.artist || 'Escolha uma música aprovada para ouvir.'}</p>
								<small>Vídeo incorporado do YouTube</small>
							</div>
							<div className="sideCard topSongs">
								<div className="sideCardTitle">
									<h3>⭐ Mais votadas</h3>
									<button onClick={() => setView('ranking')}>Ver todas →</button>
								</div>
								{topVoted.map((track, index) => (
									<button className="topSong" key={track.id} onClick={() => startTrack(track)}>
										<span>{index + 1}</span>
										<Cover track={track} />
										<span>
											<strong>{track.title}</strong>
											<small>{track.artist}</small>
										</span>
										<b>{track.votes} votos</b>
									</button>
								))}
								{!approved.length && <p>Os votos aparecerão aqui.</p>}
							</div>
							<div className="rulesCard">
								<div className="rulesTitle">
									<ShieldCheck size={19} />
									<h3>Combinados da turma</h3>
								</div>
								<p>
									{room.rules ||
										'Respeite o clima da aula e escolha músicas que todo mundo possa curtir.'}
								</p>
								<div className="rule">
									<span>Limite por aluno</span>
									<strong>
										{room.maxSuggestions === 0 ? 'Sem limite' : `${room.maxSuggestions} vídeos`}
									</strong>
								</div>
							</div>
						</aside>
					</div>
				)}
			</main>
			<footer className="playerBar">
				<div className="playerCurrent">
					<div className="footerArt">
						{current?.artwork ? (
							<Image src={current.artwork} alt="" width={47} height={47} />
						) : (
							<Music2 size={23} />
						)}
					</div>
					<div>
						<strong>{current?.title || 'Sua trilha começa aqui'}</strong>
						<small>{current?.artist || 'Sala de Som · YouTube'}</small>
					</div>
				</div>
				<div className="playerControls">
					{view === 'playlist' ? (
						<>
							<button
								onClick={previous}
								title="Música anterior"
								aria-label="Música anterior"
								disabled={!ready || !current || currentQueueIndex <= 0}
							>
								<SkipBack size={20} />
							</button>
							<button
								className="playPause"
								onClick={() => {
									if (!ready || !current) return
									if (playing) player.current?.pauseVideo?.()
									else player.current?.playVideo?.()
								}}
								title={playing ? 'Pausar' : 'Reproduzir'}
								disabled={!ready || !current}
							>
								{playing ? <Pause size={21} /> : <Play size={21} />}
							</button>
							<button onClick={next} title="Próxima música" disabled={!ready || !current}>
								<SkipForward size={20} />
							</button>
							<span>{ready ? 'Player pronto' : 'Carregando player'}</span>
						</>
					) : (
						<span>Abra a playlist para ouvir</span>
					)}
				</div>
				<span className="footerClass">{room?.name || 'Nenhuma turma selecionada'}</span>
			</footer>
		</div>
	)
}

function Cover({ track }: { track: { artwork?: string | null; title: string } }) {
	return (
		<div className="cover">
			{track.artwork ? (
				<Image src={track.artwork} alt={'Capa de ' + track.title} width={47} height={47} />
			) : (
				<Music2 size={20} />
			)}
		</div>
	)
}

function SuggesterAvatar({ track }: { track: Pick<Track, 'suggestedAvatar' | 'suggestedBy'> }) {
	return (
		<span className="suggesterAvatar" aria-hidden="true">
			{track.suggestedAvatar ? (
				<Image src={track.suggestedAvatar} alt="" width={20} height={20} unoptimized />
			) : (
				track.suggestedBy.charAt(0).toUpperCase()
			)}
		</span>
	)
}
