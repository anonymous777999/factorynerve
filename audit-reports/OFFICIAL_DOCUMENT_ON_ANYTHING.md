Here is a cost analysis and report structured for the multi-tier OCR capabilities in the product, using the exact test run costs calculated earlier.

---

# OCR Cost & Performance Analysis Report

This report breaks down the token execution costs across three distinct processing tiers—**Haiku 4.5** (Lowest), **Sonnet 5.6** (Mid), and **Opus 4.7** (Higher)—measured against standard data extraction tests.

All conversions utilize a baseline exchange rate of **1 USD = ₹94.49 INR**.

---

## 1. Multi-Tier Cost Breakdown

The table below tracks the live execution costs for processing standard handwritten or factory log data across the three model profiles:

| Tier | Model | Sample Run Cost (USD) | Cost in INR (Rupees) | Cost in Paise | Performance Profile |
| --- | --- | --- | --- | --- | --- |
| **Lowest** | Claude Haiku 4.5 | $0.004316 | ₹0.41 | **41 paise** | Lightning-fast routing, clean text digitizing, lowest overhead. |
| **Mid** | Claude Sonnet 5.6 | $0.012996 | ₹1.23 | **123 paise** | High-accuracy structural layout mapping, tabular matching. |
| **Higher** | Claude Opus 4.7 | $0.024190 | ₹2.29 | **229 paise** | Heavy reasoning, deep correction of corrupted/faded text. |

---

## 2. Core Takeaways & Margin Strategy

* **The 1-Rupee Boundary:** Haiku 4.5 operates comfortably under the half-rupee mark per run (41 paise). This makes it highly profitable for high-volume, standard text-cleansing bundles.
* **The Sweet Spot (Sonnet 5.6):** At roughly ₹1.23 per standard run, the mid-tier delivers complex table parsing at a highly scalable cost factor, serving as the benchmark for a standard "Growth" plan.
* **Premium Optimization (Opus 4.7):** While Opus 4.7 provides elite reasoning for severely smudged or complex layouts, its operational cost is **5.6× higher** than Haiku 4.5. This tier should be strictly metered or reserved for premium enterprise workflows to safeguard margins.

---

> **Operational Recommendation:** To protect backend margins against variations in image resolution (which changes token counts), implementing a **Prompt Caching** architecture or pushing async processing into **Batch API Modes** will drop these per-run costs by up to 50%, further widening unit profit margins.

