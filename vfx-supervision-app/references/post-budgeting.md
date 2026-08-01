# Post-Production Budgeting Reference

## Table of Contents
1. [Budget Structure](#budget-structure)
2. [Shot Cost Estimation](#shot-cost-estimation)
3. [Vendor Contract Structures](#vendor-contract-structures)
4. [Change Orders & Overages](#change-orders--overages)
5. [Contingency Allocation](#contingency-allocation)
6. [Cost Reporting & Burn Tracking](#cost-reporting--burn-tracking)
7. [Internal vs. Outsource Decision](#internal-vs-outsource-decision)
8. [Tax Incentive Considerations](#tax-incentive-considerations)

---

## Budget Structure

### Top-Level VFX Budget Components

| Line Item | Typical % of Total VFX Budget |
|-----------|-------------------------------|
| Vendor VFX (external facilities) | 60–75% |
| Internal VFX (in-house team) | 10–20% |
| On-set VFX supervision & equipment | 3–8% |
| Software & licenses | 1–3% |
| Storage & data management | 1–2% |
| Travel & accommodation | 1–3% |
| Contingency | 10–15% |

### Budget Phases
- **Development budget** — rough-order-of-magnitude based on script, ±50% accuracy
- **Pre-production budget** — based on breakdown and prelim bids, ±20% accuracy
- **Production budget** — finalized bids, locked scope, ±10% accuracy
- **Post budget** — updated at shoot wrap with final shot list and any overages to date

---

## Shot Cost Estimation

### Estimating Without Vendor Bids
When you need internal estimates before vendor bids arrive:

**Artist-day rate benchmarks (2024, varies significantly by market):**
| Role | Day Rate Range (USD) |
|------|---------------------|
| Senior Compositor | $650–$1,200 |
| Senior CG Generalist | $600–$1,100 |
| FX TD (Houdini) | $700–$1,300 |
| Matchmove Artist | $450–$800 |
| Roto / Paint Artist | $300–$600 |
| VFX Supervisor (facility) | $1,200–$2,500 |

**Days-per-shot by tier (rough guide):**
| Tier | Total Artist-Days (all disciplines) |
|------|-------------------------------------|
| T1 Simple | 2–8 |
| T2 Standard | 8–25 |
| T3 Complex | 25–60 |
| T4 Hero | 60–150 |

Multiply average artist-day rate × days to get rough shot cost.
Add **25–35% overhead** (facility overhead, VFX supervision, project management).

### Top-Down Budgeting
If you have a total VFX budget and need to understand feasibility:
1. Total budget ÷ average cost per shot = max shot count at that quality level
2. Compare to shot list; adjust scope accordingly
3. A useful benchmark: industry average for a mid-budget feature (~$50–100M) is
   $15,000–$40,000 per VFX shot all-in (enormous variation depending on complexity)

---

## Vendor Contract Structures

### Fixed Bid (Firm Fixed Price)
- Vendor prices a specific list of shots at a fixed total
- **Pros:** Predictable cost; vendor absorbs overages
- **Cons:** Vendor may cut quality to protect margin; changes are expensive; requires very
  clear scope definition upfront
- **Best for:** Well-defined shots with clear reference; T1–T2 work; repeat vendor relationships

### Time & Materials (T&M)
- Vendor bills actual hours/days at agreed rates
- **Pros:** Flexible; easy to add/change work; transparent
- **Cons:** Unpredictable total cost; requires active monitoring
- **Best for:** R&D work; experimental or evolving shots; trusted vendors only

### Hybrid
- Fixed bid for the defined shot list + T&M rates for changes and additions
- Most common structure in current industry practice
- Define **change order threshold** in the contract (e.g., >10% change to a shot = new bid)

### Contract Key Clauses to Review
- **Deliverable definition** — exact file specs, colorspace, naming convention
- **Revision policy** — how many rounds included; what counts as a revision vs. new work
- **Turnaround commitment** — how quickly vendor must respond to feedback
- **Kill fee** — what's owed if production cancels shots
- **Ownership / IP** — all work-for-hire; confirm rights are clear
- **Credits** — agree on credit language before work begins

---

## Change Orders & Overages

### What Triggers a Change Order
- New shots added to the vendor's work
- Existing shots significantly modified (new background, changed character, new FX element)
- Approved shot is rejected and must be redone with new direction
- Deliverable spec change (resolution, colorspace, added passes)
- Schedule acceleration requiring overtime

### Change Order Process
1. VFX Coordinator identifies potential change
2. VFX Supervisor confirms it's out of original scope
3. Vendor submits **written change order estimate**
4. VFX Supervisor reviews and approves
5. Production approves against budget
6. Work proceeds only after written approval

**Rule:** Never approve verbal changes. Every change = written change order.

### Managing Cumulative Overages
- Track change orders in a running **CO log** (CO#, date, shots affected, cost, status)
- Report cumulative COs against contingency at each budget review
- When COs exceed contingency: escalate to producer immediately — do not absorb silently
- Flag **creative indecision** as a budget risk early — repeated change of direction is a
  leading indicator of significant overages

---

## Contingency Allocation

### Recommended Contingency by Risk Level

| Project Type | Recommended Contingency |
|-------------|------------------------|
| Low risk (defined scope, known vendors, no new tech) | 8–10% |
| Standard feature | 10–15% |
| Heavy FX or experimental approach | 15–20% |
| First-time approach / significant R&D | 20–25% |

### Contingency Allocation by Shot Tier
Within the contingency pool, weight toward higher-risk shots:
- T4/T5 shots: allocate extra contingency per shot (these overrun most)
- New technique shots: allocate specific R&D contingency line (don't pool with production)
- Schedule-compressed work: overtime premium; reserve 2–3% for acceleration scenarios

### Contingency Release Policy
Contingency should only be released to cover:
- Scope changes approved by production
- Genuine unforeseen technical challenges
- Force majeure (set damage, equipment failure, key person illness)

Do NOT use contingency to cover: vendor underperformance, preventable errors, or unclear
scope that should have been defined upfront.

---

## Cost Reporting & Burn Tracking

### Weekly VFX Cost Report
Distribute to: VFX Producer, Line Producer, Post Supervisor

| Column | Description |
|--------|-------------|
| Vendor | Facility name |
| PO # | Purchase order reference |
| Original Bid | Contracted amount |
| Change Orders | Cumulative approved COs |
| Revised Total | Bid + COs |
| Invoiced to Date | Total invoiced |
| % Complete (shots) | Shots delivered / total shots |
| Forecast Final | Best estimate of final spend |
| Variance | Forecast − Revised Total |

### Burn Rate Analysis
- **Expected burn** = (% shots complete) × Revised Total
- **Actual burn** = Invoiced to Date
- If Actual > Expected: vendor is billing ahead of delivery — investigate
- If Actual < Expected by >20%: vendor may be falling behind schedule — flag

### Earned Value Metrics (Optional)
- **CPI (Cost Performance Index)** = Earned Value / Actual Cost; <1.0 = over budget
- **SPI (Schedule Performance Index)** = Earned Value / Planned Value; <1.0 = behind schedule
- Useful for larger shows with formal EVM reporting requirements

---

## Internal vs. Outsource Decision

### Factors Favoring Internal (In-House)
- High volume of T1/T2 work (cost-effective at scale)
- Creative control required throughout production
- Proprietary pipeline or tools
- Fast turnaround requirement (no vendor communication overhead)
- Show has its own studio facility

### Factors Favoring Outsource (External Vendor)
- Specialized work (e.g., creature requiring specific vendor expertise)
- Spike in volume beyond internal team capacity
- Geographic incentive program available to external vendor
- Shorter overall production (not worth hiring up)
- Experimental technique with uncertain timeline

### Hybrid Model (Most Common)
- Internal team handles: supervision, pipeline, creative review, T1 cleanup
- External vendors handle: all hero CG, complex FX, large-scale environments
- Clearly define the **handoff protocol** between internal and external teams

---

## Tax Incentive Considerations

Many jurisdictions offer tax incentives for VFX work performed locally.

### Major VFX Incentive Regions (approximate, verify current rates)
| Region | Incentive Type | Approximate Rate |
|--------|---------------|-----------------|
| UK | VGTR / HETV credit | 25–34% on qualifying spend |
| Canada (BC, ON) | Film & TV tax credit | 16–35% depending on province/program |
| Australia | PDV offset | 30% on qualifying VFX spend |
| New Zealand | NZSPG | 20% on qualifying spend |
| France | Tax rebate | 30% |
| California | Film tax credit | 20–25% |

**VFX Supervisor role in incentives:**
- Confirm that vendor costs qualify for the incentive (some work-for-hire restrictions apply)
- Ensure deliverable specifications and reporting meet incentive program requirements
- Maintain documentation of work performed in-jurisdiction vs. out
- Work with Production Accountant — don't manage incentive filings directly
