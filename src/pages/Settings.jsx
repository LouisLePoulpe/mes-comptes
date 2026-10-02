export default function Settings({ user, onImport }) {
  return <section className="max-w-2xl mx-auto space-y-5">
    <h2 className="text-2xl font-bold">Paramètres</h2>
    <div className="bg-card rounded-xl p-4 space-y-2">
      <h3 className="font-semibold">Compte connecté</h3>
      <p>Adresse e-mail : <span className="break-all">{user.email || 'Non renseignée'}</span></p>
      <p className="text-sm text-muted break-all">Identifiant : {user.uid}</p>
    </div>
    <div className="bg-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Reprendre un ancien historique</h3>
      <p>Crée ton nouveau compte avec ta nouvelle adresse, puis importe l’export complet de l’ancien compte. Garde l’ancien compte et le fichier jusqu’à la fin des vérifications.</p>
      <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={onImport}>Importer ou vérifier un export</button>
      <p className="text-sm text-muted">La comparaison vérifie les transactions contenues dans le fichier. Elle ne prouve pas que l’export de départ contient tout l’ancien historique. Aucune suppression de compte n’est effectuée ici.</p>
    </div>
  </section>
}
