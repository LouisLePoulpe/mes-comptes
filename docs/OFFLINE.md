# Fonctionnement hors connexion — 2.0.2

Après installation de cette version, ouvrir une fois l’application avec Internet
et attendre que l’icône de synchronisation devienne verte. Le coffre, l’historique complet et les paramètres
sont alors disponibles sur cet appareil. Ne pas désinstaller ou effacer les
données de l’application tant que des changements attendent leur synchronisation.

Les opérations, comptes, catégories et préférences peuvent être ajoutés ou
modifiés sans réseau. Les suppressions d’opérations et de catégories sont aussi
mises en attente. Les données Firestore restent chiffrées dans le cache persistant
IndexedDB, isolées par chemin utilisateur. Firestore conserve sa file de mutations
entre les redémarrages et la transmet automatiquement au retour du réseau.
Les formulaires attendent l’application locale de leur mutation, pas son accusé
de réception serveur. L’icône près de Dashboard et Historique est verte lorsque
les données sont synchronisées, orange pendant la synchronisation et rouge hors
ligne. Un appui affiche les détails. En cas de modifications concurrentes du
même document sur plusieurs appareils, la dernière écriture appliquée l’emporte.

Une première connexion/configuration, la suppression complète du compte et
l’import avec contrôle des doublons nécessitent Internet. Les exports restent
disponibles hors ligne. Un cache de coffre absent n’est jamais traité comme un
coffre vierge à recréer. La vérification du chiffrement utilise les documents
locaux sans réseau et ne contourne pas un refus d’autorisation serveur.

Validation : `npm run test:offline` utilise la PWA compilée avec des émulateurs
Firebase. Le navigateur coupe réellement son réseau, redémarre l’application,
ajoute/modifie/supprime des opérations et change une préférence. Un second
redémarrage confirme la persistance, l’export et le déverrouillage par passphrase.
Après reconnexion, une session indépendante sans cache vérifie les données du
serveur. Ces scénarios tournent sur ordinateur et mobile dans la CI.
