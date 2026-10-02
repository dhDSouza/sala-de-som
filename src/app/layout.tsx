import './globals.css'

export const metadata = { title: 'Sala de Som', description: 'A playlist da turma, feita pela turma.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body>{children}</body>
		</html>
	)
}
