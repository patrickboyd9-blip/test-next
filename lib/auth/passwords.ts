import bcrypt from "bcryptjs"

const ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS)
}

export async function passwordMatches(password: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}

export function passwordAccepted(password: string): boolean {
  return password.length >= 10 && password.length <= 200
}
