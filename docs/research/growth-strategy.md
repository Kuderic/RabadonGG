# Rabadon.GG Growth & User Acquisition Strategy

A research-backed playbook for growing a LoL champion-select assistant from under 100 MAU to meaningful scale.

---

## 1. Community Channels — Where LoL Players Discover New Tools

### Reddit

Reddit remains the single highest-leverage organic channel for a new LoL tool. The key communities and how to use each:

**r/leagueoflegends** (6M+ members)
- Rules are strict about self-promotion. Do not post "check out my tool." Instead, make a value-first post: share an interesting data finding derived from your scoring engine (e.g., "I scraped lolalytics matchup data for every top-lane champion this patch — here's which 3 are statistically undervalued in draft"). Mention the tool naturally in the body and comments.
- Mega-threads (LFG, Quick Questions, Weekly Discussion) allow low-friction tool mentions without triggering the spam filter.
- Post timing matters: Tuesday and Wednesday evenings (US time) after patch day drive the highest engagement on tool/data posts.

**r/summonerschool** (630K+ members)
- This is the most receptive sub for tools. Users here are explicitly trying to improve. A post like "Built a champion-select scorer that ranks every champion for your role based on the actual draft — feedback welcome" fits perfectly within the sub's culture.
- The community rewards transparency and genuine engagement. Respond to every comment in the first 2 hours.
- Rule: follow the 10% self-promotion guideline — contribute genuine answers to other posts before and after your own post goes up.

**Champion Mains Subreddits** (r/zedmains, r/jinxmains, r/supportlol, r/junglemains, etc.)
- These are high-conversion niches. A post in r/supportlol showing "which supports are most undervalued when paired with [popular ADC] this patch" directly solves a real problem for those readers.
- Tactic: Create a "weekly draft report" post specific to that champion — e.g., "Jinx draft primer: best allies and worst matchups this patch by lolalytics data."

**r/leagueoflegendsmeta / r/CompetitiveLoL**
- Good for positioning Rabadon.GG as a tool used by players who care about draft theory, not just individual performance.

---

### Discord

Discord is where the high-intent LoL improvement audience lives.

**Key server categories to target:**

- **Coaching servers**: GAPPED.GG, ELOELEVATE.GG, The Outplay Zone, lolcoach.academy — these communities have users actively looking for tools that help them prepare better drafts.
- **Role-specific improvement servers**: Servers for jungle one-tricks, support mains, mid-lane coaching — find them on DISBOARD.org filtered by tag and member count.
- **Pro/high-elo servers**: Servers run by Challenger/Master players or coaches who stream.

**Engagement approach:**
- Do not drop a link and leave. Participate genuinely for 1–2 weeks first.
- Offer to run a "draft prep" live session in voice — walk through a real scenario using Rabadon.GG.
- Ask server admins for a "partner tools" or "useful resources" channel pin.

---

### TikTok / YouTube / Twitter (X)

The sweet spot for a tool at this stage is **mid-tier creators (10K–500K subscribers)** — they are actively looking for collaboration opportunities and have highly engaged, not-yet-saturated audiences.

**YouTube:**
- Coaching/guide creators who cover champion select and draft theory are the natural fit: Midbeast (VOD reviews), Pekin Woof (challenger mid-lane content), and role-specific guide channels.
- The pitch is not a paid sponsorship — offer early access or a custom data export they can use to make a data-backed claim in a video.

**TikTok:**
- "Champion select advice" content is its own TikTok niche. Short clips showing "what to pick when enemy locks Yone + Darius" are inherently shareable.
- TikTok's LoL content community (#leagueoflegends has billions of views) rewards visual hook + data combination. A "I scored every champion against this enemy team" screen recording is a natural format.

**Twitter/X:**
- A weekly tweet showing "most improved/most declining picks this patch per synergy+counter scoring" gives you a regular content cadence tied to the game's natural rhythm.
- Tag relevant high-elo accounts and coaches when data involves their champion pool.

---

### Twitch Integration Opportunities

- Streamers who do "educational champion select" segments are ideal targets for a live demo integration.
- **Overwolf's platform** (113M MAU) supports in-game overlay apps for League specifically — publishing a companion app on Overwolf is a major distribution channel that gets your tool in front of 45M+ gamers with built-in discoverability.

---

## 2. SEO Opportunities

### The Competitive Landscape

The counter-picking keyword space is heavily occupied: OP.GG, U.GG, Mobalytics (35M monthly visits), METAsrc, CounterStats, ChampionCounter, loltheory.gg, and SeeMeta all rank for "champion counter" head terms. Competing head-on is not feasible in the short term.

**The viable approach is long-tail + intent differentiation.**

### High-Value Keyword Clusters

| Cluster | Example Queries | Rationale |
|---|---|---|
| Full-draft context queries | "best pick vs Darius Yone Malzahar team" | Zero competition — existing tools answer 1v1 counters, not full-draft scoring |
| Role-specific draft advice | "best mid lane picks with Jinx Nautilus bot lane" | Synergy-aware queries, no established result page |
| Champion + patch freshness | "best jungle picks patch 26.11" | High patch-cycle search volume, lower competition |
| "Champion select assistant" / "draft helper" | "lol draft helper", "best champion for my draft" | Navigational/tool-seeking intent, Rabadon can own this niche |

### Static Content Page Strategy

A React SPA renders client-side and is essentially invisible to crawlers without SSR or pre-rendering. This is the most important technical fix for SEO.

1. **Pre-rendered static pages per champion/role**: Build `/champions/[name]/[role]` pages (e.g., `/champions/jinx/adc`) showing top synergy/counter data. 160 champions × 5 roles = ~800 pages — each one a legitimate search landing page.
2. **Draft scenario content pages**: Thematic pages like "Best ADC picks with Nautilus support" or "How to counter a poke comp in mid lane."
3. **Patch-based content**: Pages that update on patch cadence and appear fresh in search.

### Technical SEO for the React SPA

- **Short-term**: Add `react-helmet-async` to inject per-page title tags and meta descriptions.
- **Medium-term**: Use Vite SSR or migrate static/content pages to Astro or Next.js, keeping the interactive tool as a client-side island.
- **Structured data**: Add `WebApplication` JSON-LD schema to help Google understand what the tool does.
- **Sitemap + canonical tags**: Auto-generate a sitemap from the champion/role page structure.

### Content Angle Differentiation

The differentiator no existing tool covers: **full draft context scoring**. Build editorial content around this:

- "Why champion counters are useless without full draft context" (thought leadership, link bait)
- "The 5 most synergy-dependent champions in the current meta" (shareable data post)
- Patch-day tier lists generated by the scoring engine (recurring content)

---

## 3. Influencer / Creator Partnerships

### Outreach Strategy

1. **Tool-as-content angle**: Pitch "here is a data story our tool found that your audience would love — you can use it as the hook for a video." The creator gets original content, you get exposure.
2. **Custom data exports**: Offer a creator a custom report — e.g., "Here are the 10 most undervalued picks for your main role this patch with full breakdown." Make the output screenshot-worthy.
3. **Free premium access**: If/when you add premium features, offer free lifetime access to creators with >5K relevant audience.
4. **Coach partnerships**: Reach out to coaches on Metafy and ProGuides. They give draft advice professionally and Rabadon.GG is a data source they could use in sessions.

---

## 4. Product-Led Growth

### Shareable Results

- **Shareable result URLs**: Each result should produce a stable URL with the full draft encoded in query params (e.g., `rabadon.gg/draft?role=mid&allies=Jinx,Nautilus&enemies=Darius,Yasuo,Lulu`). Users can post these to Discord/Reddit for "what should I pick" advice threads.
- **Share card image**: An OG image endpoint that renders the top 3 picks as a styled card — 1200×630 for Twitter/Discord unfurl. Turns every shared link into passive marketing.
- **Copy-as-text button**: One-click copy of "Top 3 picks: Orianna (+3.2%), Twisted Fate (+2.9%), Viktor (+2.7%) via rabadon.gg" for pasting into chat.

### High-Leverage Distribution Plays

- **Discord bot**: A `/draft` slash command that returns top 5 picks for a given role + draft directly in Discord chat. This is the highest-leverage distribution play for the LoL community — draft discussions happen live in Discord.
- **Twitch Panel Extension**: Streamers can display live results in their panel.

---

## 5. Launch Strategy

### Product Hunt

**Pre-launch (2 weeks before):**
- Create a maker profile and engage with other launches in the gaming/tools category.
- Prepare tagline: "The champion-select assistant that scores every pick against your full draft, not just one opponent."
- Create a 60-second demo GIF showing a real draft scenario.

**Launch day:**
- Launch at 12:01 AM PST to maximize the 24-hour window.
- Avoid Mondays and days when major tech products are launching.
- The first 3 hours are critical — alert your Reddit/Discord community simultaneously.

### Gaming Tool Directories

- **Overwolf Appstore**: Gives access to 45M+ gamers with built-in LoL game detection.
- **AlternativeTo.net**: List as an alternative to OP.GG, U.GG, METAsrc — captures searchers who already know those brands.
- **ToolFinder / There's An AI For That**: Increasingly where tool-seekers browse.
- **Curated "best LoL tools" articles**: Sites like itero.gg, tips.gg, egamersworld publish roundups that rank in Google and drive steady referral traffic.

---

## 6. Retention Mechanics

### Patch-Based Re-Engagement

- LoL patches every two weeks. Every patch day is a legitimate reason to re-engage users: "Patch 26.11 dropped — here's what changed for your most-played roles."
- A "what changed this patch" delta view (e.g., "Orianna synergy score up +1.2% this patch") gives returning users a new reason to check results.

### Personalization

- Allow users to save their "main role" and "champion pool" — gives a reason to send relevant notifications.
- "Champion availability" alerts: "Your main Twisted Fate is now a top-3 pick in mid this patch."

### Meta Shift Alerts

- A weekly "meta shift digest" email showing the biggest risers/fallers mirrors what U.GG's newsletter does — drives consistent re-engagement by anchoring content to the game's natural cadence.

---

## 7. Short-Term vs Long-Term Growth Plays

### Next 30 Days (Zero-Cost, High-ROI)

| Action | Channel | Expected Impact |
|---|---|---|
| Post a value-first data thread to r/summonerschool | Reddit | 500–2K immediate visitors |
| Share data post in 3 champion mains subs | Reddit | Targeted high-conversion traffic |
| Join 5 coaching Discord servers, participate 1 week, then share | Discord | 50–200 high-intent users |
| Implement shareable result URLs with OG image | Product | Turns every shared link into passive marketing |
| Submit to AlternativeTo.net + 2–3 "best LoL tools" articles | Directories | Steady long-term referral traffic |
| Create TikTok and post 3 "best picks for this draft" clips | TikTok | Brand awareness |
| Reach out to 5 mid-tier YouTube guide creators with a custom data story | Creator outreach | 1 conversion = potentially 10K–50K views |

### Next 6 Months (Compounding Growth)

| Action | Channel | Expected Impact |
|---|---|---|
| Build pre-rendered champion/role static pages (SSG) | SEO | Long-tail organic traffic compounds at 3–6 months |
| Discord bot with `/draft` slash command | Distribution | Viral loop inside existing LoL Discord communities |
| Overwolf companion app submission | Distribution | Access to 45M gamers with LoL-specific targeting |
| Patch-day content + email re-engagement system | Retention | Improve MAU retention from single-visit to recurring |
| Product Hunt launch | Launch | 500–3K traffic spike, press pickup potential |
| 2–3 formal creator collaborations with coaching channels | Creator | Sustained referral traffic, brand credibility |
| "Best champion vs [champion]" long-tail article series | SEO/Content | Indexable content targeting low-competition long-tail queries |
| Meta shift weekly digest newsletter | Retention | Reactivates churned users on every patch |

---

## Positioning Recommendation

**Rabadon.GG is not another counter-picker. It is the only tool that scores every champion against the full draft.**

Every marketing message should lead with this differentiator. OP.GG tells you who beats Yasuo in isolation; Rabadon.GG tells you who is optimal given that Yasuo + Darius + Lulu + Nautilus are already locked in. This positioning is defensible, clearly differentiated, and directly addresses a pain point LoL players discuss constantly in Reddit and Discord threads.
