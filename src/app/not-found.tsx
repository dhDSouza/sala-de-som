import Link from 'next/link'

export default function NotFound() {
	return (
		<main className="errorPage">
			<section className="errorCard">
				<span className="eyebrow">ERRO 404</span>
				<h1>Página não encontrada</h1>
				<p>O endereço solicitado não existe ou foi alterado.</p>
				<Link href="/">Voltar ao início</Link>
			</section>
		</main>
	)
}
