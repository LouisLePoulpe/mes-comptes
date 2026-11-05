import { effectiveAmount } from './reimbursement.js'

export function accountMovements(transaction) {
  if (transaction.type === 'Transfert') return [[transaction.banque, -transaction.montant], [transaction.banqueDest, transaction.montant]]
  // Une dépense remboursée compte pour 0 (effectiveAmount).
  const amount = effectiveAmount(transaction)
  return [[transaction.banque, transaction.type === 'Entrée' ? amount : -amount]]
}

export function accountPeriodAmounts(
  accounts,
  transactions
) {
  const cents =
    Object.fromEntries(
      accounts.map(account => [
        account.id,
        0,
      ])
    )

  for (
    const transaction
    of transactions
  ) {
    for (
      const [accountId, amount]
      of accountMovements(transaction)
    ) {
      cents[accountId] =
        (cents[accountId] || 0) +
        Math.round(
          Number(amount || 0) * 100
        )
    }
  }

  return Object.fromEntries(
    Object.entries(cents).map(
      ([accountId, value]) => [
        accountId,
        value / 100,
      ]
    )
  )
}
