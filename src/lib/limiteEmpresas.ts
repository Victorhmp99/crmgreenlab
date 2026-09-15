/**
 * Limite padrão de empresas que a pessoa pode CRIAR, pelo cargo. Espelha
 * `limite_de_empresas()` no banco — quem decide é o banco; isto é só pra
 * mostrar o número certo na tela quando não há ajuste do super admin.
 */
export function limitePadraoEmpresas(role: string, isSuperAdmin = false): number | null {
  if (isSuperAdmin) return null
  if (role === 'admin')   return 10
  if (role === 'manager') return 2
  return 0
}

export function rotuloLimite(override: number | null, role: string, isSuperAdmin = false): string {
  const v = override ?? limitePadraoEmpresas(role, isSuperAdmin)
  return v === null ? '∞' : String(v)
}
