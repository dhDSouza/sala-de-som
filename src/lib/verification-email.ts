import nodemailer from 'nodemailer'

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		}

		return entities[character]
	})
}

export function emailDeliveryConfigured() {
	return Boolean(
		process.env.SMTP_HOST &&
		process.env.SMTP_PORT &&
		process.env.SMTP_USER &&
		process.env.SMTP_PASSWORD &&
		process.env.SMTP_FROM,
	)
}

export async function sendVerificationEmail(to: string, name: string, token: string, invite?: string) {
	if (!emailDeliveryConfigured()) throw new Error('SMTP não configurado')
	const port = Number(process.env.SMTP_PORT)

	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT inválido')
	const origin = process.env.APP_URL

	if (!origin || (process.env.NODE_ENV === 'production' && !origin.startsWith('https://')))
		throw new Error('APP_URL precisa ser uma URL HTTPS em produção')
	const url = new URL('/verify-email', origin)

	if (invite) url.searchParams.set('invite', invite.toUpperCase())
	url.hash = `verify=${token}`
	const verificationUrl = url.toString()
	const safeName = escapeHtml(name)
	const safeUrl = escapeHtml(verificationUrl)
	const transport = nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port,
		secure: port === 465,
		requireTLS: port !== 465,
		auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
	})

	await transport.sendMail({
		from: process.env.SMTP_FROM,
		to,
		subject: 'Confirme seu cadastro no Sala de Som',
		text: `Olá, ${name}.\n\nConfirme seu e-mail para ativar sua conta:\n${verificationUrl}\n\nEste link expira em 1 hora. Se você não pediu o cadastro, ignore esta mensagem.`,
		html: `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirme seu cadastro</title></head>
<body style="margin:0;padding:32px 16px;background:#0b0d16;font-family:Arial,Helvetica,sans-serif;color:#f6f2ff">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;border:1px solid #3c3455;border-radius:16px;background:#151a2a">
    <tr><td style="padding:32px 32px 0;color:#c9a8ff;font-size:20px;font-weight:700">♫ Sala de Som</td></tr>
    <tr><td style="padding:24px 32px 32px">
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#ffffff">Confirme seu e-mail</h1>
      <p style="margin:0 0 16px;line-height:1.6;color:#e2deeb">Olá, ${safeName}!</p>
      <p style="margin:0 0 28px;line-height:1.6;color:#c9c4d3">Falta só um passo para ativar sua conta e participar das playlists da turma.</p>
      <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#a878ef;color:#130d20;font-weight:700;text-decoration:none">Confirmar meu e-mail</a>
      <p style="margin:28px 0 12px;line-height:1.5;color:#aeb0c1;font-size:14px">Se o botão não funcionar, abra este link:</p>
      <p style="margin:0;overflow-wrap:anywhere;word-break:break-all;font-size:13px;line-height:1.5"><a href="${safeUrl}" style="color:#d3b7ff">${safeUrl}</a></p>
      <p style="margin:28px 0 0;border-top:1px solid #3c3455;padding-top:20px;color:#aeb0c1;font-size:13px;line-height:1.5">O link expira em 1 hora. Se você não pediu este cadastro, ignore esta mensagem.</p>
    </td></tr>
  </table>
</body>
</html>`,
	})
}
