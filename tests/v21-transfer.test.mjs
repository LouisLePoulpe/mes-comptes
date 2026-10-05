import {
  test,
} from 'node:test'

import assert from 'node:assert/strict'

import * as XLSX from 'xlsx'

import {
  createExportV21,
  V21_SHEET_NAMES,
} from '../src/transfer/export.js'

import {
  parseExportV21,
} from '../src/transfer/parse.js'

import {
  assertImportV21Same,
  planImportV21,
} from '../src/transfer/plan.js'


test(
  'V2.1 export contains every collection with stable IDs and exact links',
  async () => {
    const data = {
      accounts: [
        {
          id: 'account_current',
          name: 'Courant',
          color: '#123456',
        },
        {
          id: 'account_savings',
          name: 'Épargne',
          color: '#654321',
        },
      ],

      initialBalances: [
        {
          id: 'initial_1',
          accountId:
            'account_current',
          label:
            'Solde de départ',
          amount: 1234.56,
          date:
            '2026-01-01T00:00:00.000Z',
        },
      ],

      categories: [
        {
          id:
            'default_charges',
          nom:
            'Charges 💸',
          roleId:
            'charges',
          defaultRole: true,
        },
      ],

      transactions: [
        {
          id:
            'periodic_rule_1_2026-10-05',
          type:
            'Sortie',
          montant: 42,
          banque:
            'account_current',
          categoryId:
            'default_charges',
          categorie:
            'Charges 💸',
          description:
            '=texte conservé',
          date:
            '2026-10-05T00:00:00.000Z',
          recurringRuleId:
            'rule_1',
          recurringOccurrence:
            '2026-10-05',
        },
        {
          id:
            'transfer_1',
          type:
            'Transfert',
          montant: 100,
          banque:
            'account_current',
          banqueDest:
            'account_savings',
          categoryId:
            'default_savings',
          categorie:
            'Économie 🏦',
          description:
            'Épargne',
          date:
            '2026-10-06T00:00:00.000Z',
        },
      ],

      recurringRules: [
        {
          id:
            'rule_1',
          type:
            'Sortie',
          montant: 42,
          banque:
            'account_current',
          categoryId:
            'default_charges',
          description:
            'Loyer test',
          startDate:
            '2026-01-05',
          endDate:
            '2027-01-05',
          interval: 1,
          unit:
            'month',
          active: false,
          effectiveFrom:
            '2026-10-05',
        },
      ],
    }

    const file =
      createExportV21(data)

    const book =
      XLSX.read(
        await file.arrayBuffer(),
        {
          type: 'array',
          raw: true,
        }
      )

    assert.deepEqual(
      book.SheetNames,
      V21_SHEET_NAMES
    )

    const rows = name =>
      XLSX.utils.sheet_to_json(
        book.Sheets[name],
        {
          raw: true,
          defval: '',
        }
      )

    assert.deepEqual(
      rows('Comptes'),
      [
        {
          ID:
            'account_current',
          Nom:
            'Courant',
          Couleur:
            '#123456',
        },
        {
          ID:
            'account_savings',
          Nom:
            'Épargne',
          Couleur:
            '#654321',
        },
      ]
    )

    assert.deepEqual(
      rows(
        'Montants initiaux'
      )[0],
      {
        ID:
          'initial_1',
        CompteID:
          'account_current',
        Nom:
          'Solde de départ',
        Montant:
          1234.56,
        Date:
          '2026-01-01T00:00:00.000Z',
      }
    )

    assert.deepEqual(
      rows(
        'Catégories'
      )[0],
      {
        ID:
          'default_charges',
        Nom:
          'Charges 💸',
        RoleID:
          'charges',
        ParDéfaut: true,
      }
    )

    const transactions =
      rows('Transactions')

    assert.equal(
      transactions.length,
      2
    )

    assert.equal(
      transactions[0]
        .RèglePériodiqueID,
      'rule_1'
    )

    assert.equal(
      transactions[0]
        .OccurrencePériodique,
      '2026-10-05'
    )

    assert.equal(
      transactions[0]
        .Description,
      '=texte conservé'
    )

    assert.equal(
      transactions[1]
        .CompteDestID,
      'account_savings'
    )

    assert.deepEqual(
      rows(
        'Transactions périodiques'
      )[0],
      {
        ID:
          'rule_1',
        Type:
          'Sortie',
        Montant:
          42,
        CompteID:
          'account_current',
        CompteDestID:
          '',
        CatégorieID:
          'default_charges',
        Description:
          'Loyer test',
        PremièreOccurrence:
          '2026-01-05',
        Fin:
          '2027-01-05',
        Intervalle:
          1,
        Unité:
          'month',
        Active:
          false,
        DateEffet:
          '2026-10-05',
      }
    )

    /*
     * Une chaîne commençant par "="
     * doit rester du texte et ne pas
     * devenir une formule Excel.
     */
    assert.equal(
      book.Sheets.Transactions
        .H2.f,
      undefined
    )
  }
)


test(
  'V2.1 export can be parsed back without guessing names or relationships',
  async () => {
    const original = {
      accounts: [
        {
          id: 'a1',
          name: 'Courant',
          color: '#123456',
        },
        {
          id: 'a2',
          name: 'Épargne',
          color: '#654321',
        },
      ],

      initialBalances: [
        {
          id: 'i1',
          accountId: 'a1',
          label: 'Départ',
          amount: -25.5,
          date:
            '2026-01-01T00:00:00.000Z',
        },
      ],

      categories: [
        {
          id: 'c1',
          nom: 'Charges 💸',
          roleId: 'charges',
          defaultRole: true,
        },
        {
          id: 'c2',
          nom: 'Économie 🏦',
          roleId: 'savings',
          defaultRole: true,
        },
      ],

      transactions: [
        {
          id: 't1',
          type: 'Transfert',
          montant: 100,
          banque: 'a1',
          banqueDest: 'a2',
          categoryId: 'c2',
          categorie: 'Économie 🏦',
          description: 'Épargne',
          date:
            '2026-10-05T00:00:00.000Z',
        },
        {
          id:
            'periodic_r1_2026-10-05',
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          categorie: 'Charges 💸',
          description: 'Loyer',
          date:
            '2026-10-05T00:00:00.000Z',
          recurringRuleId: 'r1',
          recurringOccurrence:
            '2026-10-05',
        },
      ],

      recurringRules: [
        {
          id: 'r1',
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          description: 'Loyer',
          startDate:
            '2026-01-05',
          interval: 1,
          unit: 'month',
          active: true,
          effectiveFrom:
            '2026-10-05',
        },
      ],
    }

    const file =
      createExportV21(
        original
      )

    const parsed =
      parseExportV21(
        await file.arrayBuffer(),
        file.name
      )

    assert.deepEqual(
      parsed,
      original
    )
  }
)


test(
  'V2.1 parser rejects malformed structure, unknown roles and broken references',
  async () => {
    const base = {
      accounts: [
        {
          id: 'a1',
          name: 'Courant',
          color: '#123456',
        },
      ],

      initialBalances: [],

      categories: [
        {
          id: 'c1',
          nom: 'Charges 💸',
          roleId: 'charges',
          defaultRole: true,
        },
      ],

      transactions: [],

      recurringRules: [],
    }

    const valid =
      createExportV21(
        base
      )

    const book =
      XLSX.read(
        await valid.arrayBuffer(),
        {
          type: 'array',
        }
      )

    delete book
      .Sheets[
        'Montants initiaux'
      ]

    book.SheetNames =
      book.SheetNames.filter(
        name =>
          name !==
          'Montants initiaux'
      )

    const missingSheet =
      XLSX.write(
        book,
        {
          type: 'array',
          bookType: 'xlsx',
        }
      )

    assert.throws(
      () =>
        parseExportV21(
          missingSheet,
          'bad.xlsx'
        ),
      /cinq onglets/
    )


    const invalidRoleBook =
      XLSX.read(
        await valid.arrayBuffer(),
        {
          type: 'array',
        }
      )

    invalidRoleBook
      .Sheets[
        'Catégories'
      ]
      .C2.v =
        'role-inconnu'

    const invalidRole =
      XLSX.write(
        invalidRoleBook,
        {
          type: 'array',
          bookType: 'xlsx',
        }
      )

    assert.throws(
      () =>
        parseExportV21(
          invalidRole,
          'bad-role.xlsx'
        ),
      /RoleID inconnu/
    )


    const broken = {
      ...base,

      initialBalances: [
        {
          id: 'i1',
          accountId:
            'compte-inexistant',
          label: 'Départ',
          amount: 10,
          date:
            '2026-01-01T00:00:00.000Z',
        },
      ],
    }

    const brokenFile =
      createExportV21(
        broken
      )

    const brokenBuffer =
      await brokenFile.arrayBuffer()

    assert.throws(
      () =>
        parseExportV21(
          brokenBuffer,
          brokenFile.name
        ),
      /CompteID inconnu/
    )
  }
)


test(
  'V2.1 import plan creates missing IDs and skips strictly identical records',
  () => {
    const source = {
      accounts: [
        {
          id: 'a1',
          name: 'Courant',
          color: '#123456',
        },
        {
          id: 'a2',
          name: 'Épargne',
          color: '#654321',
        },
      ],

      categories: [
        {
          id: 'c1',
          nom: 'Charges 💸',
          roleId: 'charges',
          defaultRole: true,
        },
      ],

      initialBalances: [
        {
          id: 'i1',
          accountId: 'a1',
          label: 'Départ',
          amount: 100,
          date:
            '2026-01-01T00:00:00.000Z',
        },
      ],

      transactions: [
        {
          id: 't1',
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          categorie: 'Charges 💸',
          description: 'Test',
          date:
            '2026-10-05T00:00:00.000Z',
        },
      ],

      recurringRules: [],
    }


    const existing = {
      accounts: [
        {
          color: '#123456',
          name: 'Courant',
          id: 'a1',
        },
      ],

      categories: [
        {
          roleId: 'charges',
          defaultRole: true,
          id: 'c1',
          nom: 'Charges 💸',
        },
      ],

      initialBalances: [],
      transactions: [],
      recurringRules: [],
    }


    const plan =
      planImportV21(
        source,
        existing
      )


    assert.equal(
      plan.accounts.length,
      1
    )

    assert.equal(
      plan.accounts[0].id,
      'a2'
    )

    assert.equal(
      plan.categories.length,
      0
    )

    assert.equal(
      plan.initialBalances.length,
      1
    )

    assert.equal(
      plan.transactions.length,
      1
    )

    assert.equal(
      plan.recurringRules.length,
      0
    )

    assert.deepEqual(
      plan.skipped,
      {
        accounts: 1,
        categories: 1,
        initialBalances: 0,
        transactions: 0,
        recurringRules: 0,
      }
    )

    assert.equal(
      plan.totalToCreate,
      3
    )

    assert.equal(
      plan.totalSkipped,
      2
    )


    /*
     * Les données à écrire ne doivent
     * plus contenir leur ID : celui-ci
     * sert de nom de document Firestore.
     */
    assert.deepEqual(
      plan.transactions[0],
      {
        id: 't1',

        data: {
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          categorie: 'Charges 💸',
          description: 'Test',
          date:
            '2026-10-05T00:00:00.000Z',
        },
      }
    )
  }
)


test(
  'V2.1 import plan blocks an existing ID whose data differ',
  () => {
    const source = {
      accounts: [
        {
          id: 'a1',
          name: 'Courant',
          color: '#123456',
        },
      ],

      categories: [],
      initialBalances: [],
      transactions: [],
      recurringRules: [],
    }


    const existing = {
      accounts: [
        {
          id: 'a1',
          name:
            'Même ID mais autre nom',
          color: '#123456',
        },
      ],

      categories: [],
      initialBalances: [],
      transactions: [],
      recurringRules: [],
    }


    assert.throws(
      () =>
        planImportV21(
          source,
          existing
        ),
      error => {
        assert.equal(
          error.code,
          'IMPORT_CONFLICT'
        )

        assert.equal(
          error.collection,
          'accounts'
        )

        assert.equal(
          error.documentId,
          'a1'
        )

        assert.match(
          error.message,
          /données différentes/
        )

        return true
      }
    )
  }
)


test(
  'V2.1 final import guard never accepts different data for the same ID',
  () => {
    assert.equal(
      assertImportV21Same(
        'accounts',
        'a1',
        {
          name: 'Courant',
          color: '#123456',
        },
        {
          color: '#123456',
          name: 'Courant',
        }
      ),
      true
    )


    assert.throws(
      () =>
        assertImportV21Same(
          'accounts',
          'a1',
          {
            name: 'Courant',
            color: '#123456',
          },
          {
            name: 'Autre compte',
            color: '#123456',
          }
        ),
      error => {
        assert.equal(
          error.code,
          'IMPORT_CONFLICT'
        )

        assert.equal(
          error.collection,
          'accounts'
        )

        assert.equal(
          error.documentId,
          'a1'
        )

        return true
      }
    )
  }
)

test(
  'V2.1 parser rejects a transaction linked to a missing recurring rule',
  async () => {
    const data = {
      accounts: [
        {
          id: 'a1',
          name: 'Courant',
          color: '#123456',
        },
      ],

      initialBalances: [],

      categories: [
        {
          id: 'c1',
          nom: 'Charges 💸',
          roleId: 'charges',
          defaultRole: true,
        },
      ],

      transactions: [
        {
          id:
            'periodic_rule_missing_2026-10-05',
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          categorie: 'Charges 💸',
          description: 'Loyer test',
          date:
            '2026-10-05T00:00:00.000Z',

          /*
           * Référence volontairement
           * inexistante dans recurringRules.
           */
          recurringRuleId:
            'rule_inexistante',

          recurringOccurrence:
            '2026-10-05',
        },
      ],

      recurringRules: [
        {
          id: 'rule_1',
          type: 'Sortie',
          montant: 42,
          banque: 'a1',
          categoryId: 'c1',
          description: 'Loyer test',
          startDate: '2026-10-05',
          interval: 1,
          unit: 'month',
          active: true,
          effectiveFrom:
            '2026-10-05',
        },
      ],
    }

    /*
     * createExportV21 ne doit pas avoir
     * à deviner ni réparer les relations.
     * C'est le parseur d'import qui doit
     * refuser la référence cassée.
     */
    const file =
      createExportV21(data)

    await assert.rejects(
      async () =>
        parseExportV21(
          await file.arrayBuffer(),
          file.name
        ),
      /règle périodique.*introuvable/i
    )
  }
)
