# Design Tokens — Gimmick · Obsidian

Valori **esatti e autorevoli**. Tutti gli altri file derivano da questi.

## Tipografia

| Ruolo | Famiglia | Note |
|---|---|---|
| UI / testo | **Geist** | pesi 400/500/600/700 |
| Mono / etichette / date / conteggi / eyebrow | **Geist Mono** | pesi 400/500/600 |

- Eyebrow/label: 10–11px, weight 700, `letter-spacing: 0.12–0.18em`, uppercase, colore `subtle`.
- Titoli schermata: 20–30px, weight 600–700, `letter-spacing: -0.015em`.
- Corpo: 13–15px, `line-height: 1.5–1.55`.
- Minimo testo leggibile: **12px** (requisito di leggibilità su card piccole; usare ≥12.5px per il corpo).

## Accento — Phantom Violet (unico)

| | Light | Dark |
|---|---|---|
| accent | `#7C5CCB` | `#AB9FF2` |
| accent-ink (testo su accento) | `#ffffff` | `#1b0d2e` |
| accent-soft (sfondo tenue) | `#efeafb` | `#2e2747` |

## Neutri

### Light
| token | hex |
|---|---|
| canvas | `#f6f6f8` |
| surface | `#ffffff` |
| surface2 | `#f1f0f4` |
| head (intestazioni) | `#fbfbfc` |
| field (input) | `#ffffff` |
| text | `#1b1923` |
| muted | `#5c5868` |
| subtle | `#9a96a4` |
| faint | `#c4c1cd` |
| line | `rgba(24,20,38,0.08)` |
| line2 | `rgba(24,20,38,0.13)` |

### Dark
| token | hex |
|---|---|
| canvas | `#161616` |
| surface | `#1e1e1e` |
| surface2 | `#262626` |
| head | `#1b1b1b` |
| field | `#1e1e1e` |
| text | `#dcdcdc` |
| muted | `#9a9a9a` |
| subtle | `#6e6e6e` |
| faint | `#4a4a4a` |
| line | `rgba(255,255,255,0.08)` |
| line2 | `rgba(255,255,255,0.13)` |

## Scala colori-tipo (CANONICA — usare ovunque)

Stesso ruolo, stesso hex, su desktop e mobile.

| Tipo | Light | Dark |
|---|---|---|
| Foto (photo) | `#4F86EE` | `#7AA7F5` |
| Video | `#E0588C` | `#F08DB4` |
| Voce (voice/audio) | `#E0544F` | `#F38682` |
| Testo (text) | `#3FAE72` | `#74D6A2` |
| File | `#C99220` | `#E7C25E` |
| Galleria (gallery) | `#8C7BE0` | `#B0A2EE` |

## Colori semantici (derivati dalla scala tipo)

| Ruolo | Light | Dark |
|---|---|---|
| success / timed (verde) | `#3FAE72` | `#74D6A2` |
| error / deadline (rosso) | `#E0544F` | `#F38682` |
| info / all-day (blu) | `#4F86EE` | `#7AA7F5` |
| warning / amber | `#C99220` | `#E7C25E` |

## Raggi

| Elemento | Raggio |
|---|---|
| Card / pannelli | 12–14px |
| Controlli (input, bottoni, chip rettangolari) | 8–10px |
| Pill / chip / segmented | full (999px) |
| Icona in box | 6–10px |

## Elevazione

- Niente ombre dure. Card su canvas: bordo `1px solid line` (eventuale ombra `0 1px 3px rgba(24,20,38,0.05)` in light).
- Separazione affidata a `surface` vs `surface2` e alle hairline, non alle ombre.

## Colore tile (impostazione globale)

Due modalità, controllate da un tweak/preferenza globale:

- **Tinta (Tint)**: sfondo = colore-tipo a bassa opacità + bordo colorato.
  - Light: alpha sfondo ≈ `0x17` (~9%), alpha bordo ≈ `0x40` (~25%).
  - Dark: alpha sfondo ≈ `0x26` (~15%), alpha bordo ≈ `0x4d` (~30%).
- **Pieno (Solid)**: card su `surface` con accento solo su un dettaglio (chip/icona).

## Spaziatura

Scala coerente a step di 4: `4, 6, 8, 10, 12, 14, 18, 22, 24, 32, 40, 56`px. Gap di lista 1px (hairline) o 8–12px (card). Padding card 12–24px.
