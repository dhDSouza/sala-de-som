'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Music2 } from 'lucide-react'

export default function VerifyEmailPage() {
	const [token, setToken] = useState('')
	const [message, setMessage] = useState('')
	const [busy, setBusy] = useState(false)
	const [verified, setVerified] = useState(false)
	const [invite, setInvite] = useState('')

	useEffect(() => {
		const value = new URLSearchParams(window.location.hash.slice(1)).get('verify')
		const inviteCode = new URLSearchParams(window.location.search).get('invite')

		if (inviteCode && /^[a-f0-9]{8}$/i.test(inviteCode)) setInvite(inviteCode.toUpperCase())
		if (value) setToken(value)
		else setMessage('Link de confirmação inválido. Faça o cadastro novamente.')
	}, [])

	async function confirm() {
		if (!token || busy) return
		setBusy(true)
		setMessage('')
		try {
			const response = await fetch('/api/auth/password/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token }),
			})
			const result = await response.json()

			if (!response.ok) throw new Error(result.error || 'Não foi possível confirmar o e-mail.')
			setVerified(true)
			setToken('')
			window.history.replaceState(null, '', window.location.pathname + window.location.search)
		} catch (caught) {
			setMessage((caught as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<main className="authPage verifyPage">
			<section className="authIntro">
				<div className="authBrand">
					<Music2 size={30} /> Sala de Som
				</div>
				<h1>Confirme seu e-mail</h1>
				<p>Ative sua conta para participar das playlists da turma.</p>
			</section>
			<section className="authFormSide">
				<div className="authFormCard verifyCard">
					<h2>{verified ? 'E-mail confirmado' : 'Só falta um passo'}</h2>
					<p>
						{verified
							? 'Sua conta está ativa. Você já pode entrar.'
							: 'Confirme o endereço usado no cadastro.'}
					</p>
					{message && (
						<div className="alert error" role="alert">
							{message}
						</div>
					)}
					<div className="verifyActions">
						{!verified && token && (
							<button className="primary authSubmit" type="button" onClick={confirm} disabled={busy}>
								{busy ? 'Confirmando...' : 'Confirmar e-mail'}
							</button>
						)}
						<Link className="authGoogle" href={invite ? `/?invite=${invite}` : '/'}>
							Voltar para entrar
						</Link>
					</div>
				</div>
			</section>
		</main>
	)
}
