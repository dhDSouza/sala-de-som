import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString('hex')
	const derived = (await scrypt(password, salt, keyLength)) as Buffer

	return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
	const [algorithm, salt, hash] = stored.split(':')

	if (algorithm !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false
	const derived = (await scrypt(password, salt, keyLength)) as Buffer

	return timingSafeEqual(derived, Buffer.from(hash, 'hex'))
}
