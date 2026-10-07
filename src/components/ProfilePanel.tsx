'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Save, Trash2 } from 'lucide-react'
import { feedbackDuration } from '@/lib/feedback'
import FeedbackToast from '@/components/FeedbackToast'

type ProfileUser = {
	name: string
	email: string | null
	avatar: string | null
	role: 'ADMIN' | 'TEACHER' | 'STUDENT'
}

export default function ProfilePanel({ user, onChanged }: { user: ProfileUser; onChanged: () => Promise<void> }) {
	const [preview, setPreview] = useState(user.avatar)
	const [removeAvatar, setRemoveAvatar] = useState(false)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [selectedFileName, setSelectedFileName] = useState('')
	const photoInput = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		return () => {
			if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
		}
	}, [preview])

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

	return (
		<section className="profilePage panel">
			<FeedbackToast
				error={error}
				message={message}
				onCloseError={() => setError('')}
				onCloseMessage={() => setMessage('')}
			/>
			<div>
				<span className="eyebrow">MEU PERFIL</span>
				<h2>Dados pessoais</h2>
				<p>Atualize seu nome e escolha uma foto de até 2 MB.</p>
			</div>
			<form
				className="profileForm"
				aria-busy={busy}
				inert={busy}
				onSubmit={async (event) => {
					event.preventDefault()
					if (busy) return
					setBusy(true)
					setError('')
					setMessage('')
					try {
						const form = new FormData(event.currentTarget)

						form.set('removeAvatar', String(removeAvatar))
						const response = await fetch('/api/profile', { method: 'PATCH', body: form })
						const data = await response.json()

						if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o perfil.')
						setPreview(data.avatar)
						setSelectedFileName('')
						if (photoInput.current) photoInput.current.value = ''
						setRemoveAvatar(false)
						setMessage('Perfil atualizado.')
						await onChanged()
					} catch (caught) {
						setError((caught as Error).message)
					} finally {
						setBusy(false)
					}
				}}
			>
				<div className="profilePhoto">
					<div className="profilePreview">
						{preview && !removeAvatar ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={preview} alt="Foto do perfil" />
						) : (
							<span>{user.name[0]?.toUpperCase()}</span>
						)}
					</div>
					<label className="secondary photoButton">
						<Camera size={17} /> Escolher foto
						<input
							ref={photoInput}
							name="avatar"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							onChange={(event) => {
								const file = event.target.files?.[0]

								if (file) {
									setPreview(URL.createObjectURL(file))
									setSelectedFileName(file.name)
									setRemoveAvatar(false)
								}
							}}
						/>
					</label>
					{selectedFileName && <span className="selectedFileName">{selectedFileName}</span>}
					<button
						className="secondary"
						type="button"
						onClick={() => {
							if (photoInput.current) photoInput.current.value = ''
							setPreview(null)
							setSelectedFileName('')
							setRemoveAvatar(true)
						}}
					>
						<Trash2 size={17} /> Remover
					</button>
				</div>
				<label>
					Nome
					<input name="name" defaultValue={user.name} required minLength={2} maxLength={100} />
				</label>
				<label>
					E-mail
					<input value={user.email || 'Não informado'} disabled />
				</label>
				<label>
					Perfil de acesso
					<input
						value={
							user.role === 'ADMIN' ? 'Administrador' : user.role === 'TEACHER' ? 'Professor' : 'Aluno'
						}
						disabled
					/>
				</label>
				<button className="primary" type="submit" disabled={busy}>
					<Save size={17} /> {busy ? 'Salvando...' : 'Salvar perfil'}
				</button>
			</form>
		</section>
	)
}
