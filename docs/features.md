# Core Features (Priority Order)

## MVP — Champion Recommendation

- Input: user's role + partial draft state (ally + enemy champions + roles)
- Output: ranked list of recommended champion picks for the user's role, with scores and explanations
- Score = weighted aggregate of conditional winrate deltas (ally synergy + enemy counters), with role-based weighting (e.g. ADC vs ADC matchup weighted higher than ADC vs TOP)
- Transparent data: show the user which conditional stats contributed to the score
- LLM qualification: flag low sample sizes, new patch data gaps, misleading stats

## Post-Lock — Build & Rune Synthesis

- Input: locked champion + full enemy team
- Output: recommended rune page + item build
- Source: matchup-conditional item winrates + rune winrates from lolalytics, synthesized by LLM
- LLM reasoning must call out: snowball items, low sample sizes, situational picks

## Personalization

- User can define their champion pool
- Pooled champions are ranked first in recommendations
