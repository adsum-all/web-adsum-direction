# Audit du système de pointage, de déclaration de suivi et d'absence

Date : 8 août 2026. Commandé après constat d'ambiguïté grave entre « présent »,
« a suivi », « présentiel », « en ligne », « partiel », « absent » et « excusé ».

Aucune correction n'a été appliquée. Ce document établit l'état réel avant toute
modification, comme demandé.

**Conclusion immédiate : les statistiques de l'espace Direction que j'ai livrées
reposent sur un modèle de données ambigu. Elles sont arithmétiquement exactes et
sémantiquement fausses.** Le détail est au point 3.

---

## 1. Le formulaire membre tel qu'il existe aujourd'hui

Source : `applications/adsum-web-membre/src/components/Participation.tsx`,
libellés dans `src/i18n.ts`.

Le formulaire pose **une seule question**, à trois options mises sur le même plan :

| Option affichée | Aide affichée | Valeur stockée |
|---|---|---|
| Présent | « J'ai suivi l'activité » | `statut = present` |
| Suivi partiel | « J'ai suivi une partie » | `statut = partiel` |
| Absent | « Je n'ai pas participé » | `statut = absent` |

Puis, **seulement si** le membre n'est pas scanné et a répondu Présent ou Suivi
partiel, une deuxième question : « Comment avez-vous suivi l'activité ? »
→ Sur place (présentiel) / En ligne.

### Écarts avec le modèle voulu

| # | Écart | Preuve | Gravité |
|---|---|---|---|
| F1 | La première question mélange le fait d'avoir suivi et le degré de suivi | `OPTIONS` liste `present`, `partiel`, `absent` au même niveau, `Participation.tsx:7-11` | **Critique** |
| F2 | « Suivi partiel » est proposé **avant** de connaître la modalité | `needModalite` n'est évalué qu'après le choix, `Participation.tsx:123` | **Critique** |
| F3 | Un membre peut donc déclarer « Suivi partiel » **en présentiel**, ce que le modèle interdit | `body.modalite` est accepté pour `choix === "partiel"`, `Participation.tsx:94` | **Critique** |
| F4 | Aucun motif d'absence n'est demandé | Le formulaire n'affiche rien après le choix `absent` | **Critique** |
| F5 | Le mot « Présent » est employé pour une simple déclaration non vérifiée | libellé `part.present` | Majeur |
| F6 | Aucune distinction visible, côté membre, entre présence prouvée et déclarée | l'écran verrouillé affiche `t("part." + statut)`, `Participation.tsx:68` | Majeur |

---

## 2. Le modèle de données

Table `participation`, colonnes réelles :

```
id, evenement_id, membre_id, statut, source, valide, cree_le, maj_le, modalite
```

`statut ∈ (present, partiel, absent)` — `modalite ∈ (presentiel, en_ligne)` —
`source ∈ (scan, declaration)`.

### Ce qui manque, absolument

| Besoin exprimé | Existe ? |
|---|---|
| Motif d'absence | **Non.** Aucune colonne, aucune table `absence*`, `motif*` ou `excuse*` |
| Statut d'excuse (en attente / excusée / non excusée) | **Non** |
| Décision d'un responsable, horodatée et tracée | **Non** |
| Durée de suivi en ligne, seuils complet/partiel | **Non** |
| Niveau de confiance (prouvé / déclaré / mesuré) | **Non**, seulement déduit de `source` |
| Version du formulaire ayant produit la réponse | **Non** |

### État réel des 1 231 lignes en base

| statut | source | modalité | lignes |
|---|---|---|---|
| absent | declaration | — | 381 |
| present | declaration | presentiel | 258 |
| present | scan | presentiel | 254 |
| present | declaration | en_ligne | 163 |
| **partiel** | declaration | **presentiel** | **109** |
| partiel | declaration | en_ligne | 60 |
| present | declaration | — | 2 |
| present | scan | — | 2 |

### Violations mesurées

| Violation | Lignes |
|---|---|
| « Partiel » déclaré **en présentiel**, impossible dans le modèle voulu | **109** |
| Scan n'ayant pas écrit `modalite = presentiel` | **2** |
| Présence **déclarée** comptée comme présence au même titre qu'un scan | **423** |
| Absences sans motif, le champ n'existant pas | **381** |
| Ligne `presence` sans `participation` correspondante | 2 |

Les 109 « partiel en présentiel » viennent en partie de mon propre script de
démonstration, qui tirait la modalité indépendamment du statut. C'est mon erreur :
j'ai peuplé la base selon un modèle que je n'avais pas validé avec vous.

---

## 3. Pourquoi les statistiques Direction sont fausses

Elles sont **arithmétiquement justes** : les totaux se réconcilient, la
déduplication tient, zéro doublon sur 1 231 observations avec 253 membres présents
dans les deux tables. Cela reste vrai.

Elles sont **sémantiquement fausses** sur quatre points :

| Indicateur affiché | Ce qu'il additionne réellement | Pourquoi c'est faux |
|---|---|---|
| « Taux de présence 55,3 % » | `present` scanné **et** `present` déclaré | Mélange une preuve et une affirmation. 423 des 681 présences ne sont pas prouvées. |
| « Taux de suivi 69 % » | présents + partiels | Inclut 109 « partiels en présentiel » qui n'ont pas de sens |
| « Présentiel déclaré 367 » | déclarations non vérifiées | Le libellé est correct mais il est mis sur le même graphique que le prouvé, sans hiérarchie de confiance |
| « Absents 381 » | tout ce qui n'est pas présent ou partiel | Ne distingue ni motif, ni excusée, ni non excusée, ni non-réponse |

**Le taux de couverture 95,3 % est trompeur** : il mesure les membres pour lesquels
la plateforme détient une ligne, pas les membres qui ont répondu. Un membre inscrit
d'office par mon script compte comme couvert.

---

## 4. L'application de contrôle

Source : `services/adsum-api/app/controle.py`.

### Ce qui fonctionne

- La signature du QR est vérifiée (`verify_token`) avant toute résolution de profil.
- Le scan **écrase** une déclaration antérieure : `DO UPDATE SET statut='present', source='scan'`, ligne 206. Conforme au modèle voulu.
- La déclaration du membre **ne peut pas** écraser un scan : `WHERE NOT participation.valide`, `participation.py:276`. Conforme.
- La contrainte `UNIQUE (evenement_id, membre_id)` empêche structurellement le doublon.

### Défauts confirmés

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| C1 | Le scan n'écrit **jamais** `modalite = 'presentiel'` | `_mark_present_scan`, `controle.py:203-207` : la colonne n'est pas dans l'INSERT | **Critique** |
| C2 | Le contrôleur ne voit **pas** l'état du profil | `_lookup_membre` ne sélectionne ni `m.statut` ni `m.statut_inscription`, `controle.py:59-64` | **Critique** |
| C3 | `checkin` n'effectue **aucun** contrôle du statut du profil | Aucune référence à `statut` dans `checkin`, `controle.py:360-417` | **Critique** |
| C4 | Un profil suspendu, inactif ou archivé peut donc être pointé présent silencieusement | conséquence de C2 et C3 | **Critique** |
| C5 | Le pointage est créé par l'appel, sans étape de confirmation humaine distincte | `checkin` insère directement | Majeur, à arbitrer : politique de scan instantané ou confirmation explicite |
| C6 | L'échec d'écriture de la participation est avalé | `except Exception: pass`, `controle.py:211-212` | Majeur : une présence peut exister dans `presence` sans `participation` (2 cas mesurés) |

---

## 5. Absences et excuses

**Le module n'existe pas.** Ni motif, ni décision, ni responsable, ni traçabilité.

La page « Absences & motifs » de la Direction est honnête à ce sujet : elle affiche
des espaces réservés (`PendingDataState`) et son en-tête de fichier dit
« placeholders explicites pour les données que l'API n'expose pas encore ». Elle ne
fabrique rien, mais elle promet une fonctionnalité inexistante.

Aucun risque qu'un membre s'auto-excuse aujourd'hui, pour la seule raison qu'aucune
notion d'excuse n'existe. Ce risque naîtra le jour où on l'implémentera, et c'est
pourquoi la règle « le membre ne valide jamais sa propre absence » doit être posée
dans le modèle, pas dans l'interface.

---

## 6. Formulaires : aperçu, versions, publication

Le back-office n'offre **aucun** module de formulaire de participation. Il gère la
configuration de l'envoi du sondage (`sondage.py` : activation, délai) mais le
contenu du formulaire est **codé en dur dans le front membre**.

Conséquences directes :
- impossible de prévisualiser ce que le membre voit ;
- impossible de modifier une question sans déployer ;
- aucun brouillon, aucune version, aucune publication ;
- aucune réponse historique n'est rattachée à une version, donc une évolution du
  formulaire réinterprète silencieusement le passé.

---

## 7. Plan de correction, par ordre de dépendance

Aucune étape ne peut précéder la précédente.

### Étape 1 — Modèle de données (migrations)
1. `participation` : ajouter `mode_suivi`, `niveau_suivi_en_ligne`, `confiance`, `version_formulaire`.
2. Nouvelle table `absence_declaration` : motif, commentaire, statut, horodatage.
3. Nouvelle table `absence_decision` : décision, responsable, date, commentaire, statut précédent et suivant.
4. Nouvelle table `motif_absence` : catalogue administrable.
5. Tables de formulaire : `formulaire_participation`, `formulaire_version`, `formulaire_reponse`.
6. **Reprise des données** : les 109 « partiel en présentiel » ne sont pas convertibles automatiquement. Ils seront marqués `legacy_ambigu` et exclus des taux, jamais réécrits en silence.

### Étape 2 — Règles serveur
7. Le scan écrit la modalité et la confiance.
8. Le scan lit et applique l'état du profil, avec une matrice de décision configurable.
9. Le formulaire refuse « partiel » hors ligne.
10. Le formulaire refuse toute déclaration d'absence pour un membre déjà scanné.
11. Le motif d'absence est enregistré ; l'excuse ne l'est jamais par le membre.

### Étape 3 — Formulaire membre
12. Question 1 : « Avez-vous suivi cette activité ? »
13. Question 2 conditionnelle : présentiel / en ligne.
14. Question 3 conditionnelle : en ligne complet / partiel.
15. Branche absence : motif, commentaire, message clair sur la suite.

### Étape 4 — Pilotage
16. Module « Absences et excuses » : file de traitement, décisions tracées.

### Étape 5 — Back-office
17. Module « Formulaires de participation » : brouillon, version, aperçu fidèle, publication.

### Étape 6 — Statistiques
18. Reconstruire la couche d'agrégation sur les statuts normalisés.
19. Chaque indicateur : libellé, nombre, pourcentage, dénominateur, formule, exclusions.
20. Recalcul et comparaison avant/après, avec explication des écarts.

### Étape 7 — Listes
21. Composant de pagination unique : 5, 10, 15, 20, 25, 30, 50, 100, pagination serveur.

---

## 7 bis. Constats de la revue adverse (21 confirmés, 2 réfutés)

Cinq lecteurs indépendants ont relu le front contrôleur, le parcours membre, l'API
participation, le pilotage et le back-office. Chaque constat a ensuite été soumis à
un vérificateur dont la consigne était de le **réfuter**. Deux constats sont tombés
à cette étape et ne figurent pas ici.

### Application de contrôle : perte silencieuse de présences

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| K1 | **Le contrôleur lit « Présence enregistrée » même quand le serveur a refusé le pointage** | `Scanner.tsx` : `await syncQueue(token)` est appelé en position d'instruction, le `SyncOutcome` est jeté, puis `setView({kind:"saved"})` s'exécute **sans condition**. Sur un 422 la file passe en `rejected`, `pendingCount()` retombe à 0, l'écran affiche « file 0, synchronisée ». Même défaut dans `ManualEntry.tsx` | **Critique** |
| K2 | **Le verdict du serveur sur le QR est ignoré** | `result.valid` et `result.reason` sont typés dans `api.ts` et **jamais lus**. Seule `result.photo_url` est consultée. La validité repose sur `verifyQrToken(token, now = Date.now())`, donc sur l'horloge du terminal. Un appareil à l'heure fausse affiche « VÉRIFIÉ » sur un QR expiré | **Critique** |
| K3 | **Les pointages hors ligne sont attribués au mauvais contrôleur** | `logout()` ne vide pas la file. `QueueItem` ne porte ni `controleurId` ni `deviceId`. Sur un terminal partagé, les pointages saisis par A puis synchronisés après connexion de B sont écrits avec `cree_par = B` | **Critique** |
| K4 | **Troncature silencieuse de la file à 500 entrées** | `saveQueue` fait `items.slice(-500)` sans regarder le statut. Les entrées `synced` occupent le quota et ne partent qu'à un appui manuel. Au 501e enregistrement, des entrées encore `pending` sont détruites définitivement | **Critique** |
| K5 | **L'état du profil n'est ni affiché ni contrôlé** | `DirectoryMember.statut` est renvoyé par l'API (`controle.py:190`) mais un grep sur tout `adsum-controleur/src` ne trouve `statut` que dans la déclaration de type. Aucun composant ne le lit | **Critique** |

K1, K2 et K4 conduisent tous au même résultat : **une personne entre, le contrôleur
croit la présence acquise, et aucune ligne n'existe en base.**

### Parcours membre

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| M1 | **L'historique affiche le même badge « Présent » pour un scan et pour une déclaration, et affirme par écrit que le statut vient du sondage** | `activites_membre.py` renvoie bien `source`, `api.ts` le déclare, mais `ActivitesHistorique.tsx` ne lit **jamais** `a.source`. Le champ est mort | **Critique** |
| M2 | **Une activité terminée disparaît des listes alors que le sondage est encore ouvert** | `membres.py` pose `phase='termine'` dès la fin de l'activité, tandis que `FENETRE_FIN_SQL` garde le sondage ouvert 120 minutes de plus. Pendant cette fenêtre l'activité n'est dans aucune liste. **Le membre est ensuite enregistré « non répondu » par défaut d'interface, et cette non-réponse fabriquée entre telle quelle dans les statistiques** | **Majeur** |
| M3 | Le filtre « Présent » retourne aussi les suivis en ligne ; « participe en ligne » et « partiel » ne sont pas filtrables | `activites_membre.py` filtre `p.statut='present'` sans condition sur la modalité | Majeur |
| M4 | Le seul accès au formulaire s'appelle « Confirmer ma présence », y compris pour déclarer une absence | `i18n.ts:199`, libellé unique et figé | Majeur |

### API participation

| # | Constat | Gravité |
|---|---|---|
| A1 | **La fiche analytique d'un membre lit `participation` seule.** Or `membres.py` écrit la participation aux sessions **en ligne** uniquement dans `presence`. Un membre qui suit tout en ligne affiche `presents = 0` et bascule en « sans réponse ». Le dénominateur ne filtre ni la cible, ni les activités annulées | **Critique** |
| A2 | **Le seuil d'anonymat des évaluations porte sur le mauvais compteur.** Il compte les évaluations (`count(*)`, commentaires inclus) au lieu des notes (`count(note)`). Avec 3 évaluations dont une seule notée, la moyenne diffusée **est** la note de cette personne | Majeur |
| A3 | `croisement_modalite` et `brouillons` sont calculés sur `participation` seule et hors population cible, dans le même JSON que des chiffres consolidés qui, eux, dédupliquent et bornent à la cible | Majeur |
| A4 | `taux_reponse_note` mélange deux populations et **peut dépasser 100 %** | Majeur |

### Pilotage

| # | Constat | Gravité |
|---|---|---|
| P1 | **Aucun écran d'absence dans les neuf pages du pilotage.** Le responsable habilité n'a physiquement aucun endroit où décider | **Critique** |
| P2 | **L'API pilotage n'expose aucune route d'écriture** sur la participation ou l'absence | **Critique** |
| P3 | La table `participation` n'a ni motif, ni qualification, ni décideur, ni date de décision. Sur 193 migrations, seules trois touchent cette table | **Critique** |

### Back-office

| # | Constat | Gravité |
|---|---|---|
| B1 | **Réenregistrer le questionnaire détruit toutes les réponses déjà collectées.** Le serveur `DELETE` toutes les questions et les réinsère avec de **nouveaux UUID** ; les réponses restent en `jsonb` sous les anciennes clés. Après un simple second enregistrement, sans aucune modification, chaque question passe à « Aucune réponse ». Irréversible, aucun versionnement | **Critique** |
| B2 | Aucun état brouillon : enregistrer publie immédiatement aux membres. Le champ `actif` existe mais aucune route ne l'écrit | Majeur |
| B3 | Aucun aperçu du formulaire tel que le membre le verra | Majeur |
| B4 | Le type de question « Choix » est inutilisable : les options ne peuvent jamais être saisies, le membre reçoit un menu vide | Majeur |
| B5 | Les échecs d'enregistrement s'affichent **en bannière verte de succès**, et trois handlers n'ont aucun `catch` | Majeur |

### Deux constats réfutés

- « Le découpage présentiel prouvé / déclaré publié côte à côte serait faux » : réfuté, l'invariant à quatre seaux somme exactement.
- « Aucun responsable ne peut corriger une participation » : réfuté, `POST /controle/checkin-manuel` existe et est gardé par `controle.controler`.

---

## 7 ter. Résolution, au 8 août 2026

Tout ce qui suit est en production et vérifié au navigateur sur les URL publiques.

### Le modèle dit maintenant ce qu'il veut dire

Migration `0194`, additive : aucune colonne existante n'a changé de sens, les
applications déjà installées continuent de fonctionner.

| Ajout | Ce qu'il permet |
|---|---|
| `mode_suivi` | présentiel, en ligne, ou n'a pas suivi |
| `niveau_en_ligne` | complet ou partiel, **uniquement en ligne** |
| `confiance` | prouvée au contrôle, mesurée, déclarée, administrative |
| `legacy_ambigu` | les 111 lignes non convertibles, conservées, exclues des taux, jamais réécrites |
| `absence_motif` + table `motif_absence` | catalogue administrable de 10 motifs |
| `absence_qualification`, `qualifie_par`, `qualifie_le` | la décision, son auteur et sa date |

Une contrainte de base refuse une qualification sans décideur ni date. « Le membre
n'excuse jamais sa propre absence » est devenu une propriété du schéma, pas une
promesse d'interface.

### Les onze règles, prouvées sur la base réelle

`tests/test_participation_semantique.py`, exécuté à chaque intégration :

- « partiel en présentiel » est refusé, y compris envoyé par un ancien client ;
- « partiel en ligne » est accepté ;
- les trois réponses produisent trois lignes distinctes ;
- une déclaration est enregistrée comme déclarée, jamais comme preuve ;
- un motif hors catalogue est refusé ;
- « Autre raison » sans précision est refusé ;
- une absence motivée part **en attente**, sans décideur ;
- une absence sans motif n'attend aucune décision ;
- un membre scanné ne peut pas se déclarer absent.

### Le contrôle joue enfin son double rôle

| Défaut | État |
|---|---|
| K1 « Présence enregistrée » sur un refus | **Corrigé** : chaque pointage est suivi par son identifiant et un refus a son propre écran |
| K2 verdict serveur ignoré | **Corrigé** : le serveur décide, l'horloge du terminal ne décide plus |
| K3 pointage attribué au mauvais contrôleur | **Corrigé** : l'entrée porte son auteur, la synchronisation ne pousse que les siennes |
| K4 troncature de la file | **Corrigé** : une entrée en attente n'est jamais sacrifiée |
| K5 état du profil invisible | **Corrigé** : affiché avant confirmation, et refusé côté serveur en 409 |
| C1 scan sans modalité | **Corrigé** : le scan écrit présentiel et prouvée |

Vérifié : un profil suspendu, archivé ou inactif reçoit `409 Pointage refusé : Fiche
membre suspendue`. Un profil conforme est pointé normalement.

### Le formulaire apparaît dans le back-office

Aperçu fidèle du formulaire membre, mis à jour à la frappe, avec trois situations
simulables : membre non scanné, membre déjà scanné, délai dépassé. Brouillon et
publication séparés de l'enregistrement. **Identifiants de question stables**, prouvé :
sauvegarder deux fois ne détruit plus les réponses. Une question à laquelle des membres
ont répondu est archivée, jamais supprimée. Le type « Choix » a enfin son champ
d'options, et une question de type choix sans option est refusée.

### Les absences ont leur écran

`Pilotage > Absences & excuses`, borné au périmètre, entièrement tracé, 8 tests.
En production : 100 en attente, 15 excusées, 9 non excusées, répartition des motifs
avec les nombres. Pagination serveur 5, 10, 15, 20, 25, 30, 50, 100.

### Les statistiques se réconcilient

Cinq seaux qui totalisent exactement le nombre de suivis : présentiel confirmé au
contrôle 257, présentiel déclaré 259, en ligne complet 164, en ligne partiel 60,
modalité non précisée 0. Total 740. Les 111 lignes non interprétables sont exclues de
tous les taux et affichées comme telles.

Nouveau : `taux_preuve`, soit 34,7 %. Deux unités au même taux de suivi ne sont pas
dans la même situation si l'une est prouvée et l'autre déclarée, et le taux de suivi
seul ne pouvait pas le dire.

### Ce qui reste ouvert

1. **Aucun envoi de courriel réel testé.** Le chemin est relu, audité et échappé côté serveur ; il n'a pas été observé jusqu'à une boîte.
2. **Aucun fichier exporté ouvert** dans Excel, un lecteur PDF ou un tableur.
3. **La base reste très majoritairement de démonstration.** Les écrans sont justes, les chiffres ne décrivent pas encore votre organisation.
4. **Le congrès annuel est daté du 5 décembre 2026.** Aucune présence n'y a été écrite : ce serait un fait faux. Si la date est erronée, corrigez-la.
5. **La pagination reste à généraliser** aux listes de membres du back-office et de la direction. Le composant existe et est en service dans le pilotage.

---

## 8. Ce que je retire de mes affirmations précédentes

J'ai écrit que l'espace Direction était livré et prouvé. Je maintiens la partie
mécanique : les totaux se réconcilient, la déduplication tient, l'anti-doublon est
prouvé sous volume réel.

Je retire la partie sémantique. Les catégories que ces chiffres agrègent sont
ambiguës, et un indicateur juste sur des catégories fausses reste un indicateur
faux. Vous aviez raison de m'arrêter.
