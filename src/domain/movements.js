export function accountMovements(transaction) {
  if (transaction.type === 'Transfert') return [[transaction.banque, -transaction.montant], [transaction.banqueDest, transaction.montant]]
  return [[transaction.banque, transaction.type === 'Entrée' ? transaction.montant : -transaction.montant]]
}
