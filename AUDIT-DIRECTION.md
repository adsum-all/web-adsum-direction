# Audit sévère de l'espace Direction

Date : 8 août 2026. Périmètre : application Direction (front Cloudflare Pages) et sa
couche analytique côté API. Méthode : lecture du code, exécution sur la base réelle,
parcours navigateur des douze pages sur l'environnement de production.

Ce document est écrit pour être opposable. Chaque ligne porte une preuve reproductible
ou est marquée comme non prouvée. Ce qui n'a pas été fait est listé aussi
explicitement que ce qui l'a été.

---

## 1. Avertissement principal, à lire avant tout chiffre

**La base de production est peuplée à 87 % de profils de démonstration.**
63 membres sur 72 nommés portent le nom de famille `DÉMO`, et 1 197 des 1 231
observations de présence ont été écrites par le script de peuplement.

Conséquence directe : **aucun chiffre affiché aujourd'hui dans l'espace Direction ne
décrit l'organisation réelle.** Les taux (55,3 % de présence, 69 % de suivi, 71,8 % de
médiane d'assiduité) décrivent une population fabriquée pour rendre les écrans
lisibles. Ils démontrent que la chaîne fonctionne ; ils ne disent rien du Sacerdoce
Royal.

Deux risques concrets en découlent :

| Risque | Détail | Atténuation en place | Ce qui reste à faire |
|---|---|---|---|
| Décision prise sur des données fictives | Un responsable ouvrant le tableau de bord voit des taux crédibles | Le nom de famille `DÉMO` rend chaque profil identifiable à l'écran | Aucun filtre « exclure les démonstrations » n'existe. **À décider par vous.** |
| Persistance après mise en service | Les profils démo resteront après l'arrivée des vrais membres | Le script ne touche que les profils démo, il est réversible | Prévoir une purge avant ouverture réelle |

Avant ce chantier, 9 profils de démonstration portaient des patronymes parfaitement
crédibles (BOUCHARD, KOUASSI, LEFEVRE, MENSAH, NGUEMA, OKONKWO, THOMPSON, MARCHAND,
BROU) sur des domaines réservés. **Rien à l'écran ne les distinguait d'un vrai
membre.** C'était le défaut le plus dangereux de la base ; il est corrigé.

---

## 2. Matrice d'audit

État : **OK** conforme et prouvé, **CORRIGÉ** défaut trouvé puis réparé pendant ce
chantier, **RÉSERVE** fonctionne mais avec une limite à connaître, **NON FAIT**.

### 2.1 Justesse des chiffres

| Élément | État | Preuve | Risque si faux | Priorité | Correctif | Critère de validation |
|---|---|---|---|---|---|---|
| Un membre compté une seule fois par activité | OK | `test_aucun_membre_compte_deux_fois_sur_une_activite` : 0 doublon sur 1 231 observations réelles | Gonflement de la fréquentation, décisions sur des effectifs faux | Critique | Consolidation unique `_CONSO`, déduplication sur (membre, activité) | Le test échoue si un doublon apparaît |
| Le pointage QR prime sur la déclaration | OK | `test_le_scan_prime_sur_la_declaration` ; contrainte `participation_uq` ; la déclaration porte `WHERE NOT valide` | Un membre scanné pourrait se déclarer en ligne et sortir du présentiel | Critique | Résolution de modalité preuve d'abord | 4 présences scannées, toutes en « présentiel prouvé » |
| Tous les axes donnent le même total | OK | `test_les_axes_donnent_le_meme_total` sur 5 axes | Deux écrans se contredisent, plus rien n'est crédible | Critique | Un seul socle de consolidation | 1 231 par commission, tribu, coordination, pays et volet |
| Le tableau croisé boucle sur ses marges | OK | `test_le_croisement_boucle_sur_ses_marges` ; à l'écran 422+254+4+1+0 = 681 | Un total faux invalide la lecture en pourcentages | Critique | Marges calculées à partir des mêmes cellules | Somme des cellules = total général |
| L'arborescence égale la somme de ses enfants | OK | `test_l_arborescence_egale_la_somme_de_ses_enfants` ; 1 231 = synthèse | La descente hiérarchique devient inexploitable | Majeur | Agrégation en Python depuis les feuilles, une seule requête | Chaque nœud = somme de ses enfants, récursivement |
| Taux de couverture sous filtre | **CORRIGÉ** | Avant : EUROPE affichait 10,9 % (7 vus / 64 actifs globaux). Après : 100 % (7 / 7) | Un responsable conclut que sa coordination ne remonte rien | **Critique** | `_effectif_du_perimetre` : seuls les filtres décrivant les personnes réduisent le dénominateur | `test_la_couverture_compare_au_perimetre_filtre` |
| Période ne réduit pas l'effectif | OK | `test_restreindre_la_periode_ne_reduit_pas_l_effectif` | La couverture monterait en rétrécissant la fenêtre | Majeur | Filtres d'activité exclus du dénominateur | 64 actifs quelle que soit la période |
| Axe « Commission » mélangeait commissions et missions | **CORRIGÉ** | La table `commission` contient 9 commissions et 6 missions. La page Organisation affichait 9, mon axe en groupait 15 | Deux chiffres différents pour ce qui se lit comme la même chose | Majeur | Axe renommé « Commission ou mission » ; nouvel axe « Type d'unité » | Croisement : commissions 72,4 %, missions 61,9 % |

### 2.2 Filtres

| Élément | État | Preuve | Risque | Priorité | Critère |
|---|---|---|---|---|---|
| Un filtre restreint toujours | OK | `test_un_filtre_restreint_toujours` sur volet, période, genre | Un filtre qui élargit ment sur son intitulé | Critique | Total filtré <= total global |
| Dimension inconnue refusée | OK | 422 en production sur `?dimension=inexistante` | Un axe dicté de l'extérieur rend les chiffres invérifiables | Majeur | 422 + liste des clés acceptées |
| Filtre inconnu refusé | OK | `test_un_filtre_inconnu_est_refuse` | Ignorer un filtre montre une population plus large sous un titre contraire | **Critique** | Levée d'exception, jamais un résultat élargi |
| Filtres appliqués uniformément | OK | Un seul objet de filtres, une seule fonction d'assemblage, une dépendance FastAPI partagée | Un panneau filtré à côté d'un panneau qui ne l'est pas | Critique | Tous les endpoints prennent la même dépendance |
| Filtres partagés dans l'URL | OK | Vérifié au navigateur : le fragment porte les filtres, la navigation les conserve | Un lien partagé montrerait d'autres chiffres | Mineur | `#/crossings?coordination=...` rejoue la même vue |
| Filtres en cascade cohérents | OK | Changer de coordination efface l'intendance et la commission choisies dans la précédente | Filtrer sur une unité hors périmètre renvoie zéro, lu comme « aucune présence » | Majeur | `definir()` purge les niveaux inférieurs |
| Périodes proposées | RÉSERVE | 5 préréglages plus deux dates libres | - | Mineur | Pas de comparaison automatique période contre période précédente. **Non fait.** |

### 2.3 Protection des données

| Élément | État | Preuve | Risque | Priorité | Critère |
|---|---|---|---|---|---|
| Suivi nominatif minimisé | OK | `test_le_suivi_nominatif_ne_transmet_que_les_champs_declares` ; 10 champs, assertion serveur sur chaque ligne | Duplication de l'annuaire, surface RGPD élargie | **Critique** | Ni courriel, ni téléphone, ni adresse, ni document, ni photo, ni date de naissance |
| Liste blanche vérifiable par le lecteur | OK | Le serveur renvoie `champs_exposes`, la page l'affiche | Une promesse de minimisation invérifiable n'en est pas une | Majeur | Bandeau visible en haut de la page |
| Pagination bornée | OK | `test_le_suivi_nominatif_borne_sa_pagination` : 500 maximum | Une requête aspirerait toute la base | Majeur | `limite=10000` renvoie 500 |
| Permission distincte pour le nominatif | OK | `membres.consulter`, séparée de `statistiques.consulter` | Une installation ne pourrait pas accorder les statistiques sans les noms | Majeur | Mapping RBAC, `test_rbac_conformite` vert |
| Envoi de rapport audité | RÉSERVE | `audit.log` écrit avant la réponse, succès comme échec | Un rapport parti sans trace | Majeur | **Non prouvé de bout en bout : aucun courriel réel n'a été envoyé pendant l'audit.** |
| Échappement du contenu envoyé | OK | Le serveur reconstruit le tableau avec `html.escape`, ne fait jamais confiance au navigateur | Injection de balises dans la boîte du destinataire | Majeur | Toute valeur passe par `escape()` |
| Lecture seule | OK | Aucun endpoint d'écriture dans `direction_routes` ; le seul POST envoie un rapport | Modification depuis un espace de pilotage | Critique | Revue du routeur |

### 2.4 Interface

| Élément | État | Preuve | Risque | Priorité | Critère |
|---|---|---|---|---|---|
| 12 pages rendues en production | OK | Parcours navigateur, rechargement complet entre chaque route | Une page blanche non détectée | Critique | Aucune page vide, aucune erreur applicative |
| Activité future présentée comme la dernière | **CORRIGÉ** | Le congrès du 5 décembre 2026 s'affichait avec 0 présent, 0 absent, pas de mobilisation | Lu comme un effondrement plutôt qu'une date à l'agenda | Majeur | Affiche désormais SINAÏ, 21 présents, 51 % |
| Courriel déformé par une capitalisation CSS | **CORRIGÉ** | `Saintgabrielsacerdoceroyal+Direction@Gmail.Com` | Adresse fausse recopiée depuis l'écran | Mineur | `text-transform: none` |
| Deux définitions sous une même étiquette | **CORRIGÉ** | « Membres actifs » : 9 sur la page Assiduité, 64 en Vue d'ensemble | Contradiction visible entre deux pages | Majeur | Renommé « Cheminement actif », avec sa limite écrite |
| Courbes non trompeuses | OK | Interpolation monotone Fritsch-Carlson ; axe des taux fixé à 100 | Une courbe lissée invente un sommet ; un axe adaptatif dramatise une série plate | Majeur | `monotonePath` ; `maxForce={100}` |
| Taux fragiles signalés | OK | En dessous de 10 observations, le taux est marqué et sort du classement par taux | Une unité de 3 personnes en tête ou en queue du classement | Majeur | Marque visible + infobulle |
| Membres trop peu observés non classés | OK | Moins de 2 observations : « données insuffisantes », jamais « décroché » | Étiqueter quelqu'un comme décroché sur une absence | Majeur | 1 membre non classé sur 61 |
| Troncature annoncée | OK | « 4 lignes non affichées. Les totaux portent sur l'ensemble. » | Un tableau coupé se lit comme complet | Majeur | Message sous chaque tableau tronqué |
| Marque blanche respectée | **CORRIGÉ** | Le profil codait en dur « Sacerdoce Royal » | Un second client lirait l'identité du premier | Majeur | Lecture de `/api/v1/marque` |
| Hooks après retour anticipé | OK | `verifier-hooks.mjs` intégré au lint | Erreur React #310, arbre entier détruit | Critique | Lint vert |
| Tableaux larges ne débordent pas | OK | `overflow-x: auto` sur chaque conteneur | Défilement horizontal de toute la page | Mineur | Vérifié sur la matrice |
| Mouvement réduit respecté | OK | `prefers-reduced-motion` désactive le tracé animé | Accessibilité | Mineur | Règle CSS |

### 2.5 Exports

| Élément | État | Preuve | Priorité | Réserve |
|---|---|---|---|---|
| Aperçu avant toute sortie | OK | Modale obligatoire, aucune action directe | Majeur | - |
| Filtres portés par l'export | OK | Le pied de page liste les filtres actifs, présent dans les quatre formats | **Critique** | Un tableau filtré sans ses filtres devient une affirmation sur toute l'organisation |
| Excel | RÉSERVE | SpreadsheetML 2003, nombres typés, en-tête gelé | Majeur | **Non ouvert dans Excel pendant l'audit.** Format `.xls`, pas `.xlsx` |
| PDF et impression | RÉSERVE | Cadre isolé, CSS d'impression A4 paysage | Majeur | **Non imprimé pendant l'audit** |
| CSV | RÉSERVE | Point-virgule et BOM pour Excel français | Mineur | **Non ouvert pendant l'audit** |
| Image PNG | RÉSERVE | Rasterisation du SVG, doublée en résolution | Mineur | Bouton branché sur la courbe de présence. **Le rendu n'a pas été inspecté visuellement.** La feuille de style n'est pas incorporée : les couleurs et la géométrie portées par les éléments passent, pas les styles CSS de la grille |
| Envoi par courriel | RÉSERVE | Endpoint audité, échappement serveur | Majeur | **Aucun envoi réel effectué.** La boîte de l'administrateur est saturée (452-4.2.2), ce qui reste bloquant côté vous |

---

## 3. Ce qui n'a pas été fait

Listé sans atténuation.

1. **Aucun envoi de courriel réel n'a été testé.** L'endpoint, l'audit et l'échappement sont en place et relus ; le chemin complet jusqu'à une boîte n'est pas prouvé.
2. **Aucun fichier exporté n'a été ouvert.** Excel, PDF, CSV et PNG sont produits par du code relu, pas par du code vu à l'œuvre.
3. **Pas de comparaison période contre période.** Le tableau de bord montre une série ; il ne dit pas « en baisse de 4 points sur le trimestre précédent ».
4. **Pas de filtre « exclure les données de démonstration ».** Décision qui vous revient : soit ce filtre, soit une purge avant ouverture.
5. **Le congrès annuel n'a pas reçu de données.** Il est daté du 5 décembre 2026, donc à venir. Écrire des présences sur un événement futur serait un fait faux inscrit en base ; je ne l'ai pas fait. **Si la date est erronée, corrigez-la et je peuplerai.**
6. **Presque aucun pointage QR réel.** 4 présences scannées sur 1 231. La colonne « Présentiel prouvé » est donc quasi vide et la répartition par modalité repose sur des déclarations.
7. **Pas de test navigateur automatisé.** Le parcours des douze pages a été fait manuellement, il n'est pas rejoué par la CI.
8. **`/api/v1/admin/annuaire/pays` renvoie 403 au rôle direction** (il exige `membres.gerer`). Le filtre par pays de la barre reste utilisable, mais la liste de référence des pays est indisponible pour ce rôle. Non corrigé : élargir cette permission dépasse le périmètre de l'espace Direction et relève d'une décision RBAC.

---

## 4. Preuves reproductibles

```bash
# Les invariants, sur la base réelle
cd adsum/services/adsum-api
.venv/Scripts/python.exe -m pytest tests/test_direction_analyse.py -q     # 16 passés

# La suite complète
.venv/Scripts/python.exe -m pytest                                        # 367 passés, 22 ignorés

# Le front
cd adsum/applications/adsum-direction
npm run lint && npm run build                                             # verts
```

Endpoints en production, avec un jeton de rôle `direction` :

```
GET  /api/v1/direction/dimensions        200
GET  /api/v1/direction/synthese          200
GET  /api/v1/direction/repartition       200   (422 sur une dimension inconnue)
GET  /api/v1/direction/croisement        200   (422 si les deux axes sont identiques)
GET  /api/v1/direction/arborescence      200
GET  /api/v1/direction/serie             200
GET  /api/v1/direction/assiduite         200
GET  /api/v1/direction/suivi-membres     200   (permission membres.consulter)
POST /api/v1/direction/rapport/envoyer   audité
sans jeton                               401
```

---

## 5. Jugement

Ce qui est solide : la chaîne de consolidation. Un seul socle, une déduplication
prouvée sur les données réelles, des totaux qui se réconcilient sur cinq axes et
trois niveaux hiérarchiques, et un refus net de toute dimension ou de tout filtre que
la plateforme ne sait pas calculer. La minimisation du suivi nominatif est vérifiable
depuis la réponse elle-même, ce qui vaut mieux qu'une promesse dans un document.

Ce qui est faible : les exports sont produits par du code relu et non par du code vu
fonctionner, et l'envoi de courriel reste théorique. Ce sont les deux endroits où je
n'ai pas de preuve, et je préfère l'écrire que de le laisser croire.

Ce qui doit vous alerter : la base est presque entièrement fictive. Les écrans sont
justes, les chiffres ne le sont pas encore.
