# POLITIQUE DE SOURCES — Module Imagerie

> **Statut** : politique ferme, toute image non conforme est rejetée.

## Processus de sourcing d'une image

1. Chercher sur les sources autorisées (voir AGENTS.md)
2. Vérifier la licence sur la page de l'image
3. Documenter dans le JSON (url, caption, source, license, licenseUrl, author, verifiedAt)
4. Vérifier l'anonymisation (pas de nom patient, pas de date de naissance)
5. Faire relire par le relecteur médical

## Cas particuliers

### Images CC BY
- Usage commercial autorisé
- Attribution obligatoire (auteur + lien licence)
- Indiquer les modifications

### Images CC0 / Domaine public
- Usage commercial autorisé
- Attribution recommandée
- Aucune restriction

### Images CC BY-NC / CC BY-NC-SA
- INTERDIT — usage non-commercial uniquement
- Alternative : chercher équivalent CC0/CC BY

### Images CC BY-ND
- INTERDIT pour usage commercial avec modifications

## Registre des images utilisées

À tenir dans `docs/IMAGING-IMAGE-REGISTRY.md` :
- Liste de toutes les images
- URL source + licence + date de vérification
- Nom du relecteur médical
- Date de publication

## Audit trimestriel

- Vérifier toutes les licences (source encore en ligne ?)
- Retirer les images dont la licence a changé
- Documenter chaque retrait dans `docs/DECISIONS.md`

## Contact en cas de réclamation

Toute réclamation de droits d'auteur traitée sous 72h à :
**onjaandrianantenainafetramandr@gmail.com**

Procédure : retrait immédiat de l'image + remplacement.
