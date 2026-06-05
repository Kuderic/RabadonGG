# Rabadon.GG Monetization Research

Research date: June 2026

---

## 1. Riot Games Monetization Policies

### What Is Explicitly Allowed

Riot's Developer Portal general policies (last updated March 11, 2025) permit:

- **Subscriptions, donations, and crowdfunding** — explicitly permitted
- **Tournament entry fees** — permitted with restrictions (70% must go to prize pool, minimum 20 participants)
- **In-product virtual currencies** — permitted so long as they cannot be converted to real money
- **Advertising on external web properties** — permitted as part of a free-tier experience

### The Mandatory Free Tier Rule

Riot requires that **all third-party products maintain a free tier of access**. Paid content must be "transformative" — meaning it adds new information, new aesthetics, new insights, or new understandings beyond the raw game data. You cannot simply lock basic core features. Monetization "cannot gouge players or be unfair."

### The May 2025 In-Game Ad Ban (Critical)

On **May 29, 2025**, Riot banned all third-party in-game advertisements. This affects:
- Ads in in-game overlays (during active play)
- Ads displayed during loading screens
- Ads in the Riot Client itself

**What is still allowed after the ban:**
- Ads on your standalone website
- Ads on your desktop app's non-overlay screens (pre-game/post-game)
- Subscriptions and premium tiers
- Donations

This ban significantly hurt Blitz and Porofessor, accelerating their moves to subscription tiers. **Rabadon.GG is a web app and is unaffected**, but any future desktop client or overlay must comply.

### Registration Requirement

Before any monetization, your product must be **registered on the Riot Developer Portal** with status "Approved" or "Acknowledged." You must display the standard Riot disclaimer.

---

## 2. How Existing LoL Tools Monetize

### Pricing Benchmark Summary

| Tool | Monthly Price | Annual Price | Primary Paywall |
|---|---|---|---|
| OP.GG | ~$3.00 | N/A disclosed | Ad removal + personalized dashboard |
| U.GG | $3.99 ($2.49/mo annual) | $29.88 | Ad removal + personal match stats |
| Blitz | ~$4.99 | N/A disclosed | Ad-free, cross-game coverage |
| Mobalytics | $7.99 | Lower (undisclosed) | AI voice coaching, combo guides |
| Porofessor | Undisclosed | N/A | Cosmetics + personalization (Q3 2025 launch) |

**Market consensus price band: $3–$5/month** for ad-removal + convenience. Premium analytics/AI justifies up to $8/month.

### Key observations

- **OP.GG's model**: Subscription is essentially a tip jar with ad-removal — core tool is entirely free. Works due to massive scale (62–76M monthly visits).
- **Mobalytics at $7.99**: Justifies the premium with genuinely differentiated ML features (GPI, voice coaching). Acquired by ESL FACEIT Group March 2025 for undisclosed amount; estimated $100–250M ARR after 8+ years.
- **Porofessor pivot**: After the Riot ad ban, M.O.B.A. Network (Swedish public company) fast-tracked premium subscription development. A higher-priced AI insights tier is in development.
- **Blitz pivot**: Same story — the overlay ad ban forced faster conversion of free users to paid.

---

## 3. Viable Monetization Models for Rabadon.GG

### 3.1 Freemium (Recommended Primary Model)

**What must stay free (Riot-required + viral hook):**
- Full draft input and champion recommendations — the core value proposition
- Top 10 picks with synergy/counter scores
- Basic role/lane weighting

**What can be paywalled (transformative additions):**
- Saved draft history and persistent configurations
- Expanded pick list beyond top 10 (25 or 50 results)
- Custom scoring profiles (save/name multiple weight configs)
- Patch delta tracking ("this champion's score changed +3.2% since last patch")
- Champion pool manager (track your pool, auto-filter recommendations)
- Team planner / full draft simulator
- Ad-free experience
- Early access to new features

### 3.2 Subscriptions

**Recommended pricing structure when you launch paid:**

| Tier | Price | Target User |
|---|---|---|
| Free | $0 | Casual players, new visitors |
| Rabadon Pro | $3.99/month or $29/year | Regular ranked players wanting more depth |
| Rabadon Pro+ | $7.99/month | Coaches, high-elo players, esports students |

Premature before ~500 MAU. **Build the audience first.**

### 3.3 Advertising

AdSense RPM for gaming is roughly **$2–$8 per 1,000 pageviews**.

| Monthly Pageviews | RPM | Monthly Revenue |
|---|---|---|
| 5,000 | $4 | $20 |
| 50,000 | $4 | $200 |
| 500,000 | $5 | $2,500 |

Viable only at significant scale. At <10K MAU it is noise. Do not add ads to the draft UI — UX cost outweighs revenue at this stage.

### 3.4 Ko-fi / Patreon / Donations

- Appropriate for the **pre-launch / <500 MAU phase** as a "buy me a coffee" signal
- Typical: 2–5% conversion, $3–$10 average donation
- Ko-fi (0% fee on tips) beats Patreon for a utility tool
- **Add a Ko-fi link in the footer now** — zero implementation cost, gives early data on willingness to pay

### 3.5 B2B (Coaches and Teams)

The esports coaching AI market reached $412.7M in 2024 (18.4% CAGR). 8,500+ US high schools and universities had established esports programs as of 2025.

**Potential B2B customers:**
- High-elo coaches on Metafy and ProGuides
- University esports program coaches
- Amateur/semi-pro team analysts
- LoL coaching platforms (Skill Capped, ProGuides) for integration/resale

**B2B product ideas:**
- Bulk draft scenario testing (run 50 draft permutations, export to CSV)
- Team profile management (track multiple player champion pools)
- PDF draft summary export
- API access for coaching platforms

Even 3–5 coaches paying $20–$30/month generates meaningful MRR at small scale and validates the product.

### 3.6 Affiliate / Sponsorships

Viable at 1K+ MAU. Gaming peripheral affiliates:
- Razer: 3–10% commission
- Logitech: up to 8%, avg order $125
- SteelSeries: 4–8%

More relevant near-term:
- LoL coaching platforms (ProGuides, Skill Capped, Metafy): 10–30% affiliate commission on coaching purchases
- VPN providers targeting gamers (NordVPN, ExpressVPN): reliable $30–$50 CPA

---

## 4. Phased Monetization Roadmap

### Phase 1: Now (<500 MAU)
**Goal: Validate product-market fit, not revenue**

- Add Ko-fi donation link in footer
- Register on Riot Developer Portal (required before any monetization)
- Display the required Riot disclaimer
- Track usage patterns to identify which features users return to
- Do NOT put anything behind a paywall — you need data and word-of-mouth more than money
- Set up analytics (Plausible, PostHog, or similar)
- Identify 3–5 "super users" early — these are potential first B2B customers

### Phase 2: 500–2,000 MAU
**Goal: Test willingness to pay, establish first paid revenue**

- Launch 1–2 lightweight premium features (saved draft history, expanded pick list) at $3.99/month or $29/year
- Consider a "Founding Member" lifetime deal at $40–$50 capped at 100 seats to generate early capital
- Add AdSense to non-draft pages (about, blog) — not the draft UI
- Direct outreach to 10–20 LoL coaches on Metafy/ProGuides — offer 3 months free Pro in exchange for feedback
- Measure: What is your free-to-paid conversion rate? Aim for 1–3%.

### Phase 3: 2,000–10,000 MAU
**Goal: Scale recurring revenue, prove unit economics**

- Expand paid features: team planner, patch delta tracking, champion pool manager
- Add a second tier at $7.99/month targeting coaches and high-elo players
- Formalize a B2B "Coach Plan" at $20–$30/month
- Pursue gaming peripheral affiliate partnerships
- Evaluate gaming-specific ad networks for better CPMs on free tier
- Target: 1–3% conversion → $400–$3,000+ MRR

### Phase 4: 10,000+ MAU
**Goal: Diversify revenue, approach sustainability**

- Coaching platform integration (white-label API or embed)
- Gaming content sponsorships (seasonal brand deals)
- Overwolf desktop client for their 70/30 subscription rev-share + ad network
- Re-evaluate pricing — $4.99–$5.99 base is defensible at scale with deepened product
- Institutional B2B (university esports programs, amateur leagues)
- Target MRR: $3,000–$10,000+

---

## 5. Revenue Math

### Subscription MRR at Key Milestones

| MAU | Conversion | Paying Users | ARPU/mo | MRR |
|---|---|---|---|---|
| 500 | 1% | 5 | $4 | $20 |
| 2,000 | 2% | 40 | $4.50 | $180 |
| 5,000 | 2% | 100 | $5 | $500 |
| 10,000 | 3% | 300 | $5 | $1,500 |
| 50,000 | 3% | 1,500 | $5 | $7,500 |

This is not "quit your job" money until 20K–50K+ MAU, which is realistic for a niche LoL tool with sustained development. For reference, Mobalytics operates at an estimated $100–250M ARR after 8+ years and venture backing.

### Realistic conversion benchmarks
- Average SaaS freemium conversion: 3–5% (good), 8–12% (great)
- Gaming apps skew lower due to younger, price-sensitive audiences
- **Realistic target for Rabadon.GG: 1–3% initially**, improving to 3–5% with strong feature differentiation

---

## Summary

1. **Do nothing monetization-related right now** except add a Ko-fi link and register on Riot's Developer Portal.
2. **Launch a paid tier at ~1,000 MAU** with saved drafts and expanded pick lists at $3.99/month or $29/year.
3. **Ignore in-game overlay monetization entirely** — Riot's May 2025 ban is a dead end.
4. **Pursue 5–10 LoL coaches directly** — B2B customers pay more and churn less.
5. **Price at $3.99/month** base (matching U.GG), not $7.99. Earn the higher price with differentiated features.
6. **Do not gate the core recommendation output** — it must remain free for Riot compliance and because it's the viral hook.
