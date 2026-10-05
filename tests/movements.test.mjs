import {
  test,
} from 'node:test'

import assert from 'node:assert/strict'

import {
  accountPeriodAmounts,
} from '../src/domain/movements.js'


test(
  'monthly account cards show only net movements of the selected period',
  () => {
    const accounts = [
      { id: 'bb' },
      { id: 'cmb' },
      { id: 'tr' },
    ]

    /*
     * Octobre 2026 :
     *
     * BB :
     * + 1164 salaire
     * - 200 vers TR
     * - 500 vers CMB
     * - 16 plaisir
     * - 16 charges
     * - 10 charges
     * - 5 charges
     * = 417
     *
     * CMB = +500
     * TR  = +200
     */
    const transactions = [
      {
        type: 'Entrée',
        banque: 'bb',
        montant: 1164,
      },
      {
        type: 'Transfert',
        banque: 'bb',
        banqueDest: 'tr',
        montant: 200,
      },
      {
        type: 'Transfert',
        banque: 'bb',
        banqueDest: 'cmb',
        montant: 500,
      },
      {
        type: 'Sortie',
        banque: 'bb',
        montant: 16,
      },
      {
        type: 'Sortie',
        banque: 'bb',
        montant: 16,
      },
      {
        type: 'Sortie',
        banque: 'bb',
        montant: 10,
      },
      {
        type: 'Sortie',
        banque: 'bb',
        montant: 5,
      },
    ]

    assert.deepEqual(
      accountPeriodAmounts(
        accounts,
        transactions
      ),
      {
        bb: 417,
        cmb: 500,
        tr: 200,
      }
    )

    assert.equal(
      transactions
        .filter(
          transaction =>
            transaction.type === 'Sortie'
        )
        .reduce(
          (
            total,
            transaction
          ) =>
            total +
            transaction.montant,
          0
        ),
      47
    )
  }
)
