import { EntitySchema } from 'typeorm'

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT'
export type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
export interface User {
	id: string
	googleId: string | null
	email: string | null
	passwordHash: string | null
	name: string
	avatar: string | null
	role: Role
	blocked: boolean
	createdAt: Date
}
export interface ClassRoom {
	id: string
	name: string
	code: string
	ownerId: string
	rules: string
	requireApproval: boolean
	maxSuggestions: number
	createdAt: Date
}
export interface Membership {
	id: string
	classId: string
	userId: string
	createdAt: Date
}
export interface ClassTeacher {
	id: string
	classId: string
	userId: string
	createdAt: Date
}
export interface Playlist {
	id: string
	classId: string
	name: string
	cover: string | null
	createdAt: Date
}
export interface Suggestion {
	id: string
	classId: string
	playlistId: string
	userId: string
	youtubeVideoId: string
	title: string
	artist: string
	artwork: string | null
	durationMs: number
	status: Status
	playedAt: Date | null
	createdAt: Date
}
export interface Vote {
	id: string
	suggestionId: string
	userId: string
	createdAt: Date
}
export interface PendingRegistration {
	id: string
	email: string
	name: string
	passwordHash: string
	tokenHash: string
	expiresAt: Date
}
export interface AuthRateLimit {
	key: string
	count: number
	windowStart: Date
}
export const UserEntity = new EntitySchema<User>({
	name: 'User',
	tableName: 'users',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		googleId: { type: 'varchar', unique: true, nullable: true },
		email: { type: 'varchar', unique: true, nullable: true },
		passwordHash: { type: 'text', nullable: true },
		name: { type: 'varchar' },
		avatar: { type: 'text', nullable: true },
		role: { type: 'varchar', default: 'STUDENT' },
		blocked: { type: 'boolean', default: false },
		createdAt: { type: 'timestamptz', createDate: true },
	},
})
export const ClassEntity = new EntitySchema<ClassRoom>({
	name: 'ClassRoom',
	tableName: 'classes',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		name: { type: 'varchar' },
		code: { type: 'varchar', unique: true },
		ownerId: { type: 'uuid' },
		rules: { type: 'text', default: '' },
		requireApproval: { type: 'boolean', default: true },
		maxSuggestions: { type: 'int', default: 5 },
		createdAt: { type: 'timestamptz', createDate: true },
	},
})
export const MembershipEntity = new EntitySchema<Membership>({
	name: 'Membership',
	tableName: 'memberships',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		classId: { type: 'uuid' },
		userId: { type: 'uuid' },
		createdAt: { type: 'timestamptz', createDate: true },
	},
	uniques: [{ columns: ['classId', 'userId'] }],
})
export const ClassTeacherEntity = new EntitySchema<ClassTeacher>({
	name: 'ClassTeacher',
	tableName: 'class_teachers',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		classId: { type: 'uuid' },
		userId: { type: 'uuid' },
		createdAt: { type: 'timestamptz', createDate: true },
	},
	uniques: [{ columns: ['classId', 'userId'] }],
})
export const PlaylistEntity = new EntitySchema<Playlist>({
	name: 'Playlist',
	tableName: 'playlists',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		classId: { type: 'uuid' },
		name: { type: 'varchar' },
		cover: { type: 'text', nullable: true },
		createdAt: { type: 'timestamptz', createDate: true },
	},
	uniques: [{ columns: ['classId', 'name'] }],
})
export const SuggestionEntity = new EntitySchema<Suggestion>({
	name: 'Suggestion',
	tableName: 'suggestions',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		classId: { type: 'uuid' },
		playlistId: { type: 'uuid' },
		userId: { type: 'uuid' },
		youtubeVideoId: { type: 'varchar' },
		title: { type: 'varchar' },
		artist: { type: 'varchar' },
		artwork: { type: 'varchar', nullable: true },
		durationMs: { type: 'int', default: 0 },
		status: { type: 'varchar', default: 'PENDING' },
		playedAt: { type: 'timestamptz', nullable: true },
		createdAt: { type: 'timestamptz', createDate: true },
	},
	uniques: [{ columns: ['playlistId', 'youtubeVideoId'] }],
})
export const VoteEntity = new EntitySchema<Vote>({
	name: 'Vote',
	tableName: 'votes',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		suggestionId: { type: 'uuid' },
		userId: { type: 'uuid' },
		createdAt: { type: 'timestamptz', createDate: true },
	},
	uniques: [{ columns: ['suggestionId', 'userId'] }],
})
export const PendingRegistrationEntity = new EntitySchema<PendingRegistration>({
	name: 'PendingRegistration',
	tableName: 'pending_registrations',
	columns: {
		id: { type: 'uuid', primary: true, generated: 'uuid' },
		email: { type: 'varchar', unique: true },
		name: { type: 'varchar' },
		passwordHash: { type: 'text' },
		tokenHash: { type: 'varchar', unique: true },
		expiresAt: { type: 'timestamptz' },
	},
})
export const AuthRateLimitEntity = new EntitySchema<AuthRateLimit>({
	name: 'AuthRateLimit',
	tableName: 'auth_rate_limits',
	columns: {
		key: { type: 'varchar', primary: true },
		count: { type: 'int' },
		windowStart: { type: 'timestamptz' },
	},
})
export const entities = [
	UserEntity,
	ClassEntity,
	MembershipEntity,
	ClassTeacherEntity,
	PlaylistEntity,
	SuggestionEntity,
	VoteEntity,
	PendingRegistrationEntity,
	AuthRateLimitEntity,
]
