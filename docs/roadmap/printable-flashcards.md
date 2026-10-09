# 🖨️ Flashcards imprimables (Premium)

**Statut** : idée retenue (roadmap) — Premium uniquement
**Estimation** : 3–5 jours

## Pitch
Générer un PDF recto/verso depuis un deck, une sélection custom ou les cartes "à revoir".
Chaque carte inclut un QR code de retour vers l'app.

**Levier business** : Premium tangible + viralité organique.

## v1
- [ ] Entrées : deck entier · sélection custom · cartes à revoir (SM-2)
- [ ] Formats : A4 (2/4/8 par page) · A6 · carte visite (10/page)
- [ ] Impression : recto · recto-verso (marges reliure)
- [ ] Styles : minimal · QCM complet · fiche mémo (Q+R+source)
- [ ] Annotations : lignes · notes · couleur par spécialité

## Carte (gabarit)
```
CARDIO · SCA · L2
Homme 61 ans, douleur thoracique...
① ② ③ ④
▸ Source : ESC 2023, classe I
▸ Optimus : #cardio-042
▸ [QR code] → reprise dans l'app
```

## QR code
- Encode `optimus://resume/{cardId}?utm=print`
- Deep link → pont retour vers l'app

## Technique
- Libs : `pdf-lib` + `qrcode` (client-side, coût 0)
- Route : `src/routes/impression.tsx`
- Gate : `entitlements.includes("print")`
- Preview watermark si free → CTA upgrade
- Export : `optimus-{deckSlug}-{date}.pdf` + `navigator.share()`

## v2+
- Coffret carnet relié · Export Anki (.apkg) · Fiche A4 par pathologie
- Imprimeurs locaux (Tana / Paris) · Templates par université
