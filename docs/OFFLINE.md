# Fonctionnement hors connexion — 2.0.2

## Démarrage local prioritaire depuis la 2.1.2

Le coffre est lu depuis IndexedDB en premier, même si le téléphone annonce une
connexion sans accès effectif à Internet. Les collections et les préférences
optionnelles sont chargées explicitement depuis le cache avant les réponses des
listeners réseau. La restauration initiale de Firebase Auth échoue immédiatement
quand l'appareil se déclare hors ligne, et est limitée à 500 ms par requête de
consultation du compte ou de renouvellement du jeton quand un réseau est annoncé
sans accès réel. Cela utilise
le comportement du SDK qui conserve sa session persistée en cas d’erreur réseau.
Les autres requêtes, notamment connexion et réauthentification, ne sont pas
interceptées. La fonction fetch originale est restaurée dès la session initialisée.
Une validation du compte reprend en arrière-plan après deux secondes et au retour
du réseau. Les changements/refus du coffre sont surveillés en arrière-plan ; un
rafraîchissement de jeton ne remet plus l’utilisateur sur le Dashboard.

Pour réduire le travail avant le premier écran : les deux documents du coffre et
la clé locale sont lus en parallèle ; chaque donnée chiffrée n'est déchiffrée
qu'une seule fois (les snapshots répétés du démarrage réutilisent le résultat, et
un snapshot sans changement ne relance aucun calcul) ; l'import Excel, l'export
et l'écran des périodiques ne sont chargés qu'à leur ouverture ; sur Android, le
cache Firestore est en mode mono-onglet, sans négociation de bail multi-onglets.

Le test de démarrage rapide bloque les requêtes Auth et Firestore tout en gardant
`navigator.onLine` à true, avec un jeton expiré. Il exige une ouverture en moins de
3,5 secondes et vérifie ensuite la reprise de synchronisation sans quitter
l’historique. Ce seuil est une régression de test, pas une garantie sur tout appareil.

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
