const ALLOWED = new Set(['pedromleal15', 'pedromleal'])

export function isAllowedGithubLogin(login: string | undefined | null): boolean {
  if (!login) return false
  return ALLOWED.has(login.trim().toLowerCase())
}

export interface GithubProfile {
  login?: string
}

export function assertPedro(profile: GithubProfile): { ok: true; login: string } | { ok: false; error: string } {
  if (!isAllowedGithubLogin(profile.login)) {
    return { ok: false, error: 'Esta conta GitHub não pode entrar. O acesso é só do Pedro.' }
  }
  return { ok: true, login: profile.login!.trim().toLowerCase() }
}
