# Statistics Definitions

This document defines the exact calculation rules for every stat. **Every statistic listed must have a matching integration test.**

## Match-Level Stats
| Stat | Definition | Forfeits | Disconnects | Bots |
|------|-----------|----------|-------------|------|
| `wins` | Match completed with player on winning team | Counted as loss for forfeiting player | Not counted | Excluded |
| `losses` | Match completed with player on losing team | Counted as loss | Not counted | Excluded |
| `kills` | Raw kills from matchParticipants.score | Counted as 0 | Counted as 0 | Excluded |
| `deaths` | Raw deaths from matchParticipants.score | Counted as 0 | Counted as 0 | Excluded |

## Career Stats
| Stat | Definition |
|------|-----------|
| `matchesPlayed` | Count of all completed matches |
| `winRate` | wins / matchesPlayed (0 if no matches) |
| `kdRatio` | kills / max(1, deaths) |
