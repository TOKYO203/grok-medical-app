# Journal des audits IA

Protocole : docs/MEDICAL-AUDIT-PROTOCOL.md

## Tableau cumulatif

| Date | Fiche | Verdict | Corrections | Appliquees | Relecteur |
|---|---|---|---|---|---|
| 2026-10-27 | pathologies/paludisme | PASS_WITH_NOTES | 1 | Oui (verifie conforme, sans modification) | audit IA 2026-11-15 ; relecture humaine en attente |
| 2026-11-15 | calculators/scores (8 fichiers, 59 scores) | PASS_WITH_NOTES | 1 | Oui | audit IA ; relecture humaine en attente |
| 2026-11-20 | decks (urgences, cardio, infectio, neuro) + valeurs-reference + ECG | PASS_WITH_NOTES | 4 | Oui (neuro-avc-l3 puis corrections residuelles decks.json issue #507, commit ef1742a) | audit IA ; relecture humaine en attente |
| 2026-11-22 | decks pharmaco, tropical, semio, dermato, physio, anatomie (46 questions) | PASS_WITH_NOTES | 3 | Oui (commit 40990433) | audit IA ; relecture humaine en attente |

## Detail

### 2026-10-27 - pathologies/paludisme
- Sources : 5 OMS/SPILF, pertinentes
- Posologie : artesunate 2,4 mg/kg conforme OMS 2024
- Seuils : 6/7 corrects, 1 a verifier (20 mmol/L)
- Scores : aucun
- A verifier : ligne 20 mmol/L paludisme.json
- Relecture humaine : en attente

### 2026-11-15 - resolution du point en attente (paludisme, uree 20 mmol/L)
- Critere OMS de paludisme grave « atteinte renale » : creatinine > 265 umol/L OU uree sanguine > 20 mmol/L (= 120 mg/dL d'uree). Sources : WHO guidelines for malaria ; Lancet Glob Health 2023 (PIIS2214-109X(23)00546-6), qui exprime « urea greater than 120 mg/dL (> 20 mmol/L) ».
- La ligne « Creatinine > 265 umol/L ou uree > 20 mmol/L » de paludisme.json est donc CONFORME (unite = uree, pas BUN). Aucune modification de contenu requise.
- Point de vigilance : ne pas convertir ce seuil en BUN (BUN 20 mmol/L = uree ~43 mmol/L, ce qui fausserait le critere).

### 2026-11-15 - calculators/scores (cardio, pneumo, neuro, infectio, nephro, pediatrie, urgences, general)
- Perimetre : formules, cotation, seuils et interpretations des 59 calculateurs.
- Verifies conformes aux sources citees : CHA2DS2-VASc, HAS-BLED, GRACE (nomogramme), TIMI, Killip, NYHA, Wells TVP, Geneve revise, PERC, HEART ; Wells EP, CURB-65 (uree > 7 mmol/L = 19,6 mg/dL BUN, conforme Lim 2003), GOLD 2023 (groupe E), CAT, mMRC, ATS/IDSA 2019, Fine ; Glasgow, ABCD2, NIHSS (max 42), mRS, Hoehn-Yahr, EDSS, Barthel, FOUR ; qSOFA, SOFA, APACHE II (cotation complete + nomogramme de mortalite), IGS II, Centor/McIsaac, MASCC, NEWS2 ; Cockcroft-Gault, MDRD IDMS, Schwartz 2009, FENa, FEUree, KDIGO ; Apgar, Silverman, Wang, Wood-Downes-Ferres, PRAM, Guarino, age corrige, taille cible (Tanner), rapport bili/albumine (AAP 2022) ; Vittel, Shock Index, TRiP(cast), Ottawa cheville/genou, RTS/T-RTS (coefficients 0,9368/0,7326/0,2908) ; IMC, DFG, QTc (Bazett/Fridericia/Hodges), BSA, poids ideal/ajuste, PaO2/FiO2, Winter.
- Corrections appliquees :
  1. Blantyre (src/content/calculators/scores/pediatrie.ts) : la definition du coma etait « score <= 2 OU score = 3 sans localisation de la douleur ». Le critere valide (OMS ; Molyneux 1989) est Blantyre <= 2/5. Condition et texte pedagogique corriges ; severite recalee (score 3 = conscience alteree non comateuse).
- Points notes (sans modification) :
  - TRiP(cast) : cotation proche du score publie (Nemeth 2021) ; relecture humaine recommandee avant tout usage clinique.
  - RTS : la severite affichee derive du RTS pondere ; le T-RTS (/12) n'est affiche qu'a titre informatif (seuil de triage canonique : T-RTS <= 11).
- Relecture humaine : en attente (l'audit IA ne vaut pas validation medicale, conformement au protocole).

### 2026-11-20 - audit IA decks urgences/cardiologie/infectiologie/neurologie + valeurs de reference + ECG
- Perimetre : 87 questions a intendance pharmacologique (doses, seuils, mmol/mmHg/mg/UI) sur decks.json + les 8 decks neuro (avc/epi L2-L5 et internes), les valeurs de reference (biochimie, hematologie, ionogramme) et 2 cas ECG (torsades, hyperkaliemie).
- Verifies conformes : alteplase 0,9 mg/kg (bolus 10 %, max 90 mg) ; seuils PA 185/110 pre-thrombolyse et <180/105 a H24 ; cible systolique ~140 mmHg dans l'HIC (INTERACT-2/ATACH) ; adrenaline 1 mg toutes les 3-5 min ; amiodarone 300 mg apres le 3e choc ; adrenaline IM 0,5 mg anaphylaxie (EAACI) ; remplissage 30 mL/kg (SSC 2021) ; sulfate de magnesium eclampsie ; test VIH 4e generation ; TLD OMS ; stats VIH 41,0 M / 1,2 M / 570 000 (fiche OMS 27 juillet 2026) ; vitamine A deux doses a 24 h (rougeole) ; schema 6 doses VAT anatoxine ; PEV Madagascar 6-10-14 semaines ; metronidazole tetanos ; azithromycine/ceftriaxone typhoide.
- Corrections appliquees :
  1. neuro-avc-l3.json (APPLIQUE sur main) : « sylvien superficial » -> « sylvien superficiel » ; « artère vertébro-cérébelleuse postéro-inférieure » -> « artère cérébelleuse postéro-inférieure (PICA) » (nom canonique du territoire de Wallenberg).
- Corrections residuelles decks.json (issue #507) APPLIQUEES le 2026-11-21 a an-1 (« Un anastomose » -> « Une anastomose »), vih-l2-5 (« simultément » -> « simultanément »), tetanos-l4-6 (« levèrent » -> « lèvent »), avc-l3-4 (« superficial » -> « superficiel » + nom canonique PICA). Commits 1026e17 (blob vide par erreur de l'outil de push volumineux) puis ef1742a (restauration avec corrections) ; JSON valide et anciennes chaines absentes verifies apres push. Relance de `npm run release:check` et regeneration des signatures Premium restent a faire en local.
- Statut : PASS_WITH_NOTES ; relecture humaine toujours en attente (l'audit IA ne vaut pas validation medicale).


### 2026-11-22 - audit IA decks pharmaco/tropical/semio/dermato/physio/anatomie (46 questions)
- Perimetre : familles restantes de la collection V1 (urgences/cardio/infectio/neuro auditees 2026-11-20, calculateurs 2026-11-15, paludisme 2026-10-27).
- Verifies conformes : paracetamol 3 g/j automedication / 1 g par prise / 4 h (ANSM), 4 g/j max sous avis ; metformine CI DFG < 30 mL/min (RCP) ; naloxone (OMS 2025) ; paludisme : fievre en zone d'endemie = palu jusqu'a preuve du contraire, artesunate parenteral >= 24 h puis CTA 3 jours des que VO toleree, TDR faussement negatif -> repeter frottis/GE (OMS 13/08/2025) ; praziquantel schistosomoses ; peste : isolement, prelevements, aminoside/fluoroquinolone, alerte sanitaire ; rage : lavage + Essen/accelere + Ig categorie III (OMS) ; impetigo localise : fusidique/mupirocine topique 1re intention (SPILF/SFD) ; SJS/Lyell : arret du suspect + transfert type brule ; erytheme migrant : diagnostic clinique, ATB sans attendre la serologie (HAS 2025) ; pulsus paradoxus > 10 mmHg ; DFG adulte ~ 120 mL/min ; effet Bohr, phase 0 Na+, AQP2, barorecepteurs (Guyton 14e).
- Corrections appliquees (commit 40990433, redactionnelles sans impact clinique) :
  1. ph-9 : enonce reconstruit (« Quelle statine est un inhibiteur de l'HMG-CoA reductase dont l'effet indesirable musculaire majeur est » -> « Les statines sont des inhibiteurs de l'HMG-CoA reductase ; leur effet indesirable musculaire majeur est »).
  2. py-8 : « vasoconstroconstriction hypoxique pulmonaire » -> « vasoconstriction pulmonaire hypoxique ».
  3. py-8 explication : « l'hypoxie alveolaire constrict les arterioles » -> « ... resserre les arterioles ».
- Verifications post-push : JSON valide, anciennes chaines absentes, fichier 864 077 octets, sha 480cb0da (pas de blob vide).
- Relecture humaine : en attente (l'audit IA ne vaut pas validation medicale, protocole docs/MEDICAL-AUDIT-PROTOCOL.md).

### 2026-11-22 (2e passe) - audit independant complet de decks.json (87 decks, ~800 questions)
- Perimetre : re-lecture integrale de decks.json (864 077 octets) : validite JSON, bornes de l'index correct, doublons d'identifiants ou de choix, puis verification ciblee des 453 questions a enjeu (doses, seuils, mmHg, %).
- Faits externes re-verifies sur sources OMS : tétanos maternel et neonatal 52/59 pays valides en juillet 2026 CONFIRME ; campagne integree rougeole-polio-vitamine A Madagascar 5-9 octobre 2026, 23 regions, 115 districts CONFIRME (OMS AFRO).
- Corrections identifiees (3) ; push de decks.json bloque par une limite memoire de l'outil d'execution (patch jq prepare, a appliquer en local puis release:check et regeneration des signatures Premium) :
  1. tetanos-l4-6 : pharmacologie — les benzodiazepines potentialisent l'inhibition GABAergique (renforcent l'action du GABA), elles ne la 'levent' pas ; explication a corriger.
  2. avc-l2-7 : imagerie hyperaigue — l'examen de premiere ligne est le scanner (disponible, rapide, ecarte l'hemorragie avant thrombolyse), cohérent avec avc-l4-1 du meme deck ; reponse et explication a corriger (avant : IRM).
  3. vih-l3-10 : le stade 4 OMS se definit cliniquement, pas par les CD4 ; le seuil de 200 CD4/mm3 est le critere de sida (CDC) ; explication a nuancer.
- Statut : PASS_WITH_NOTES ; relecture humaine toujours en attente (l'audit IA ne vaut pas validation medicale, protocole docs/MEDICAL-AUDIT-PROTOCOL.md).
