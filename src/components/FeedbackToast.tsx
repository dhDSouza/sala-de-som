'use client'

import { createPortal } from 'react-dom'

export default function FeedbackToast({
	error,
	message,
	onCloseError,
	onCloseMessage,
}: {
	error?: string
	message?: string
	onCloseError?: () => void
	onCloseMessage?: () => void
}) {
	if (typeof document === 'undefined' || (!error && !message)) return null

	return createPortal(
		<div className="feedbackToasts" aria-live="polite">
			{error && (
				<div className="alert error" role="alert">
					<span>{error}</span>
					<button type="button" onClick={onCloseError} aria-label="Fechar erro">
						×
					</button>
				</div>
			)}
			{message && (
				<div className="alert success" role="status">
					<span>{message}</span>
					<button type="button" onClick={onCloseMessage} aria-label="Fechar aviso">
						×
					</button>
				</div>
			)}
		</div>,
		document.body,
	)
}
