# Algorithm Design

## Champion Recommendation Score

The core algorithm needs to:

1. Pull conditional winrate for user's champion given each ally and enemy champion (up to 9 data points).
2. Compute a winrate delta vs. baseline for each conditional.
3. Apply role-based weights:
   - ADC matchup (ADC vs ADC): highest weight
   - Support synergy (ADC + Support): high weight
   - Enemy jungler: medium weight
   - Off-roles (ADC vs TOP, ADC vs MID): lower weight
4. Aggregate into a single score per champion candidate.
5. Handle missing data gracefully (new patches, low-play champions).

---

## Open Algorithm Questions

- Exact weighting formula (linear sum vs. multiplicative vs. something else)?
- How to handle low sample sizes — hard cutoff, soft penalty, or LLM-only flag?
- How to normalize across patches (data from current patch only vs. rolling window)?
- How to handle off-meta picks where lolalytics conditional data doesn't exist?
