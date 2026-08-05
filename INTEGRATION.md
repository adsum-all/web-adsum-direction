# Intégration de la version enrichie « fronte-direction »

Ce document trace l'intégration de la version front la plus aboutie de
l'application direction dans le dépôt officiel, les choix faits, et la marche à
suivre pour la promotion en production.

## Ce qui a été fait

La branche `integration/fronte-direction-import`, coupée depuis `develop`, porte :

- **le front à neuf pages** repris de la source (vue d'ensemble, activité en
  direct, calendrier, participation, absences, organisation, assiduité, qualité
  des données, profil), avec sa barre latérale, son routeur et son hook d'activité
  en direct, là où le dépôt officiel n'avait qu'un tableau de bord unique ;
- **la marque en marque blanche greffée** : la barre latérale et l'écran de
  connexion lisent le nom, l'initiale et les couleurs de l'organisation via
  `useMarque`, au lieu du « ADSUM » codé en dur. L'application suit donc
  l'organisation déployée, comme les autres fronts ;
- **l'unique endpoint backend manquant** : `/api/v1/admin/participation/par-entite`,
  déployé et prouvé en production. Les dix-sept autres endpoints attendus par le
  front existaient déjà.

## Audit comparatif source / cible

| | Source `fronte-direction` | Cible officielle (`develop`) |
|---|---|---|
| Fichiers `src/` | 38 | 10 |
| Pages | 9 | 1 (tableau de bord) |
| Routeur, barre latérale | oui | non |
| Marque en marque blanche | non | oui (`marque.ts`, `useMarque.ts`) |
| Traces Lovable | `.lovable`, `bun.lock` | aucune |

La source est nettement plus avancée côté front ; la cible apportait la marque.
L'intégration combine les deux : base source, marque réinjectée.

## Écarts front / backend

Le front appelle 18 endpoints. **17 existaient déjà** en production (statistiques,
participation globale, référentiels commissions / intendances / coordinations /
tribus / types d'événements, événements, annuaire pays, authentification,
permissions). **Un seul manquait**, désormais implémenté :
`/api/v1/admin/participation/par-entite`, qui alimente l'écran de répartition de
participation par entité, avec croisement de deux dimensions.

Aucune table manquante : l'endpoint réutilise la consolidation de présence
existante (`stats_core`), déduplication par (membre, événement) sur les deux
tables de présence. Aucune migration nécessaire.

## Nettoyage Lovable

Un balayage de tout le dépôt (hors `.git` et `node_modules`) ne trouve **aucune**
référence `lovable` ni `lov-adsum`. Le dossier `.lovable` et le `bun.lock` qui
pointait vers un cache Lovable n'ont pas été importés. Le `package.json` ne porte
aucune dépendance propre à l'atelier de conception ; les jetons de design partagés
sont intégrés dans `tokens.css` plutôt que tirés d'un registre privé que la CI
n'atteint pas toujours.

## Choix techniques et justifications

- **Base = source, marque réinjectée** plutôt que l'inverse : la source apporte
  neuf pages contre une, réécrire le front sur la base cible aurait été un travail
  bien plus lourd et risqué que greffer trois fichiers de marque.
- **`package.json` de la source** (sans `@adsum/tokens`) : le front source
  vendorise les tokens, donc la dépendance au registre privé est inutile et
  ferait échouer un `npm install` propre.
- **Continent dérivé de l'organisation** (coordinations / intendances) et non
  d'une correspondance pays vers continent : la base n'a pas de table de référence
  pour résoudre un pays en texte libre, et le continent de l'organisation est une
  donnée fiable déjà présente.
- **Dimension inconnue refusée en 422** : un tableau de bord en lecture seule ne
  vaut que par la confiance dans ses chiffres, donc une dimension non calculée
  échoue visiblement au lieu de renvoyer une répartition plausible mais fausse.

## Sauvegarde

Avant toute modification, le dépôt cible a été archivé sous
`.lov/.archives/repositories/` :

- `adsum-direction-complet-*.bundle` : bundle Git de toutes les branches
  (`develop`, `main`, etc.), vérifié restaurable ;
- `adsum-direction-working-tree-archive-*.zip` : arbre de travail ;
- `adsum-direction-git-etat-*.txt` : `git status`, branches, log, remotes.

Restauration : `git clone adsum-direction-complet-*.bundle restauration`.

## Guide de merge et de promotion

1. **Vérifier la MR** vers `develop` : pipeline vert, revue du diff.
2. **Fusionner vers `develop`** une fois la revue faite (jamais sur pipeline rouge).
3. Le déploiement continu vers Cloudflare Pages se déclenche sur `develop`
   (variables `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT`).
4. **Promotion vers `main`** : MR `develop -> main` après stabilisation.

## Points de vigilance restants

- Le backend `participation/par-entite` est déployé sur l'API de production ; il
  faut donc que la MR de l'API (branche `fix/calendrier-extras`) soit elle aussi
  fusionnée pour que la source reflète ce qui tourne.
- La marque est branchée sur la barre latérale et la connexion ; les libellés
  internes des pages nomment encore « ADSUM Admin » dans quelques messages d'état
  (invitations à publier côté administration), ce qui reste correct puisqu'ils
  désignent l'action, non l'organisation.
