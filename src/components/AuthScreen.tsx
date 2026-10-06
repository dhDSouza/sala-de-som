'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Music2, Users } from 'lucide-react'
import FeedbackToast from '@/components/FeedbackToast'
import { feedbackDuration } from '@/lib/feedback'

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [busy, setBusy] = useState(false)
	const [inviteCode, setInviteCode] = useState('')

	useEffect(() => {
		if (!error) return
		const timer = setTimeout(() => setError(''), feedbackDuration.error)

		return () => clearTimeout(timer)
	}, [error])
	useEffect(() => {
		if (!notice) return
		const timer = setTimeout(() => setNotice(''), feedbackDuration.success)

		return () => clearTimeout(timer)
	}, [notice])

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const reason = params.get('error')
		const invite = params.get('invite')

		if (invite && /^[a-f0-9]{8}$/i.test(invite)) {
			setInviteCode(invite.toUpperCase())
			setMode('register')
		}

		if (reason === 'local-account') setError('Esta conta usa senha. Entre com e-mail e senha.')
		else if (reason === 'google-unavailable')
			setError('O login com Google não está configurado. Use e-mail e senha.')
		else if (reason) setError('Não foi possível entrar com Google. Tente novamente.')
	}, [])

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (busy) return
		if (mode === 'register' && password !== confirmPassword) {
			setError('As senhas não coincidem.')

			return
		}
		setBusy(true)
		setError('')
		setNotice('')
		try {
			const response = await fetch(`/api/auth/password/${mode}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password, invite: inviteCode || undefined }),
			})
			const result = await response.json()

			if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.')
			if (mode === 'register' && result.pending) {
				setNotice('Se o endereço estiver disponível, enviamos um link de confirmação. Confira seu e-mail.')
				setMode('login')
				setPassword('')
				setConfirmPassword('')
			} else await onAuthenticated()
		} catch (caught) {
			setError((caught as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<main className="authPage">
			<FeedbackToast
				error={error}
				message={notice}
				onCloseError={() => setError('')}
				onCloseMessage={() => setNotice('')}
			/>
			<section className="authIntro">
				<div className="authBrand">
					<Music2 size={30} /> Sala de Som
				</div>
				<div className="authArtwork" aria-hidden="true">
					<Music2 size={110} />
				</div>
				<span className="eyebrow">A TRILHA SONORA DA TURMA</span>
				<h1>Suas músicas. Sua turma. Um só lugar.</h1>
				<p>Descubra as playlists da turma, sugira músicas, vote nas favoritas e ouça quando quiser.</p>
				<div className="authFeature">
					<Users size={19} /> Feita em conjunto, para todo mundo ouvir.
				</div>
			</section>
			<section className="authFormSide">
				<div className="authFormCard">
					<div className="authMode" role="tablist" aria-label="Forma de acesso">
						<button
							type="button"
							role="tab"
							aria-selected={mode === 'login'}
							className={mode === 'login' ? 'active' : ''}
							onClick={() => {
								setMode('login')
								setError('')
							}}
						>
							Entrar
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={mode === 'register'}
							className={mode === 'register' ? 'active' : ''}
							onClick={() => {
								setMode('register')
								setError('')
							}}
						>
							Criar conta
						</button>
					</div>
					<h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Comece a ouvir com a turma'}</h2>
					<p>
						{mode === 'login'
							? 'Entre para continuar de onde parou.'
							: 'Crie sua conta para participar das playlists.'}
					</p>
					{inviteCode && (
						<p className="inviteAuthNotice">
							Você recebeu um convite para uma turma. Crie uma conta ou entre; o acesso à turma será feito
							automaticamente após o login.
						</p>
					)}
					<form className="authForm" onSubmit={submit}>
						{mode === 'register' && (
							<label>
								Nome completo
								<input
									autoComplete="name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									minLength={2}
									maxLength={100}
									required
								/>
							</label>
						)}
						<label>
							E-mail
							<input
								type="email"
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
							/>
						</label>
						<label>
							Senha
							<span className="authPassword">
								<input
									type={showPassword ? 'text' : 'password'}
									autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									minLength={mode === 'register' ? 8 : undefined}
									maxLength={128}
									required
								/>
								<button
									type="button"
									aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
									onClick={() => setShowPassword((old) => !old)}
								>
									{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</span>
						</label>
						{mode === 'register' && (
							<label>
								Confirme a senha
								<input
									type={showPassword ? 'text' : 'password'}
									autoComplete="new-password"
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									minLength={8}
									required
								/>
							</label>
						)}
						{mode === 'register' && (
							<small>
								Use pelo menos 8 caracteres. Confirme seu e-mail para ativar a conta de aluno.
							</small>
						)}
						<button className="primary authSubmit" type="submit" disabled={busy}>
							{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
							<ArrowRight size={18} />
						</button>
					</form>
					<div className="authDivider">
						<span>ou continue com</span>
					</div>
					<a
						className="authGoogle"
						href={inviteCode ? `/api/auth/google/start?invite=${inviteCode}` : '/api/auth/google/start'}
					>
						<span className="googleG">G</span> Google
					</a>
					<small className="authFootnote">Vídeos reproduzidos pelo player incorporado do YouTube.</small>
				</div>
			</section>
		</main>
	)
}
