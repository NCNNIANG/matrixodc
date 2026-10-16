# MatrixODC

Outil de pilotage partagé de la checklist de la visite du 30 octobre 2026 à ODC.

- **Vue 360** : avancement, déroulé du 30 par séquence, matrice chantiers × statuts, blocages, retards, échéances sous 48 h, charge par porteur, jalons, activité récente.
- **Kanban** : To Do, In Progress, Blocked, Done, avec glisser-déposer.
- **Checklist** : actions à cocher, regroupées par chantier.
- **Affectation** (admin) : porteur et échéance de chaque action, et remplacement d'un rôle par un nom sur toutes ses actions en une fois.
- **Déroulé modifiable** (admin) : heure, durée et titre de chaque moment du 30 octobre, ajout ou retrait d'un moment. Bouton « Modifier le déroulé » dans la Vue 360.

Connexion par **lien + code d'accès commun**, chacun saisit son nom à l'entrée. Pas de compte, pas d'email. Un **code admin** séparé ouvre le mode admin. Les droits sont vérifiés par le serveur. Les données sont dans Supabase et ne sont lisibles que par l'application.

Technologies : Next.js 14 sur Vercel, Supabase (PostgreSQL). Les offres gratuites suffisent.

---

## Mise en service (environ 20 minutes)

### 1. Base de données (Supabase)

1. Sur https://supabase.com, cliquez **New project**. Nom : `matrixodc`. Région : la même que pour le cockpit. Notez le mot de passe.
2. Ouvrez **SQL Editor > New query**. Collez tout le contenu de `supabase/schema.sql`, puis cliquez **Run**.
3. Nouvelle requête : collez tout le contenu de `supabase/seed.sql`, puis cliquez **Run**. Les 154 actions de la checklist sont chargées.
4. Dans **Project Settings > API**, copiez :
   - **Project URL** : pour `SUPABASE_URL`
   - la clé **service_role** : pour `SUPABASE_SERVICE_ROLE_KEY`. Elle est secrète : ne la partagez jamais.

L'offre gratuite de Supabase autorise 2 projets actifs : le cockpit ODC500 et MatrixODC.

### 2. Code (GitHub)

1. Sur GitHub, créez un nouveau dépôt **privé** nommé `matrixodc`.
2. Décompressez le zip sur votre ordinateur.
3. Dans le dépôt, faites **Add file > Upload files**. Glissez tout le contenu du dossier décompressé : les dossiers `app`, `components`, `lib`, `supabase` et les fichiers `package.json`, `next.config.js`, `jsconfig.json`, `README.md`.
4. Cliquez **Commit changes**.

### 3. Mise en ligne (Vercel)

1. Sur https://vercel.com, faites **Add New > Project**, puis importez le dépôt `matrixodc`.
2. Ouvrez **Environment Variables** et ajoutez ces 5 variables :

| Nom | Valeur |
| --- | --- |
| `SUPABASE_URL` | le Project URL copié à l'étape 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role copiée à l'étape 1 |
| `ACCESS_CODE` | `Code3010ODC` |
| `ADMIN_CODE` | `AdminMatrix3010`, ou un autre code de votre choix |
| `SESSION_SECRET` | une longue phrase inventée, au moins 32 caractères, sans la noter ailleurs |

3. Cliquez **Deploy**. L'adresse de l'application s'affiche quand le déploiement passe à **Ready**, par exemple `https://matrixodc.vercel.app`.

### 4. Premier test

1. Ouvrez l'adresse, saisissez votre nom et le code d'accès.
2. Cliquez **Mode admin** et saisissez le code admin.
3. Dans l'onglet **Affectation**, remplacez chaque rôle (« Réf. sécurité »…) par le nom du porteur désigné.

---

## Modifier le déroulé

En mode admin, Vue 360 > **Modifier le déroulé**. Chaque moment a une heure de début, une durée et un titre. Le chantier rattaché prend automatiquement le nouveau titre et ses actions restent en place. Un moment qui a encore des actions ne peut pas être retiré : déplacez d'abord ses actions vers un autre chantier.

Installation déjà en ligne avant cette fonction : lancez une fois `supabase/deroule.sql` dans Supabase > SQL Editor. Sans ce script, le déroulé par défaut s'affiche mais ne peut pas être enregistré.

## Partager

Envoyez aux participants **l'adresse de l'application et le code d'accès**. Le code admin ne va qu'aux admins.

## Changer un code

Dans Vercel, **Settings > Environment Variables**, modifiez `ACCESS_CODE` ou `ADMIN_CODE`, puis **Deployments > Redeploy**.
- Changer `ACCESS_CODE` déconnecte tout le monde : chacun devra saisir le nouveau code.
- Changer `ADMIN_CODE` retire le mode admin à ceux qui l'avaient activé.

## Qui peut faire quoi

| | Participant | Admin |
| --- | --- | --- |
| Voir toutes les vues | oui | oui |
| Changer un statut, indiquer un blocage, ajouter une note | oui | oui |
| Affecter un porteur, changer une échéance, un intitulé, un chantier, une priorité | non | oui |
| Créer ou supprimer une action | non | oui |
| Modifier le déroulé du 30 octobre | non | oui |

Chaque modification est enregistrée avec le nom de la personne dans l'**Activité récente**.

## Limites à connaître

- Le nom saisi à l'entrée n'est pas vérifié : la confiance repose sur le code. Ne diffusez le code qu'aux participants.
- Les écrans s'actualisent toutes les 20 secondes, et immédiatement au retour sur l'onglet.
- Supabase met en pause un projet gratuit après 7 jours sans aucune utilisation. Il se réactive depuis le tableau de bord Supabase.
- Ne saisissez dans MatrixODC aucune pièce d'identité ni donnée personnelle sensible.

## Tester en local (développeurs)

```
npm install
MATRIX_DEMO=1 ACCESS_CODE=Code3010ODC ADMIN_CODE=AdminMatrix3010 SESSION_SECRET=une-longue-phrase-de-test-123456 npm run dev
```

`MATRIX_DEMO=1` remplace Supabase par une base en mémoire, vide au démarrage.
