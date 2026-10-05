export function userPath(uid, name, id) {
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('Utilisateur requis')
  if (!['transactions', 'categories', 'accounts', 'initialBalances', 'config'].includes(name)) throw new Error('Collection invalide')
  if (id !== undefined && (typeof id !== 'string' || !id || id.includes('/'))) throw new Error('Identifiant invalide')
  return ['users', uid, name, ...(id === undefined ? [] : [id])]
}
