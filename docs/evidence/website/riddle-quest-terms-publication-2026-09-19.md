# Riddle Quest terms publication

The owner requested creation and publication of `https://roobsworld.com/riddle-quest/terms` on the existing Vercel website.

## Scope and provenance

- Vercel project: `portfolio`, `prj_ePBIvzdYBmEXARehORy9MExKUlRQ`.
- Team: `team_vAXlm6zrxxYVKlhz90UrbIig`.
- Previous public deployment: `dpl_Em84anmHC8gp4Cz9Du3xSAJZKban`.
- Restored and SHA-1 verified all 229 source files from that deployment into `/tmp/roobs-terms-release`, then added one route: `src/app/riddle-quest/terms/page.tsx`. Existing production source was preserved because the local portfolio checkout contained substantial later changes.
- Persisted the same new route in `/home/craig-beswetherick/Documents/portfolio/src/app/riddle-quest/terms/page.tsx`. No unrelated website changes were included and no game target source or artifact was changed.
- The adjacent `riddle-quest-terms-page.tsx` is an archival copy; the portfolio repository owns the website route.

## Content sources and decisions

Owner-confirmed publisher: Roobs World; registered country: UK; business type: Company; support email: `grindheadgames@gmail.com`. The portfolio's existing legal source named Roobs World Limited and its address. Cross-checked with the [Companies House company overview](https://find-and-update.company-information.service.gov.uk/company/15560227): company 15560227, registered office 3 Wherry Way, Dobwalls, Liskeard, England, PL14 4NS.

The page covers the HTML5 game, platform eligibility, personal use, fair play, virtual coins, optional platform checkout, missing purchases, refunds and cancellation, ads, privacy, service changes, proportionate account restrictions, consumer rights and disputes. Platform-specific features are conditional; the terms do not claim the pending Facebook IAP release is live. Family-friendly content does not override platform age eligibility. No declaration about the intended Facebook audience was submitted as part of this publication.

Reference guidance: [GOV.UK online selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling), [fair consumer contracts](https://www.gov.uk/guidance/writing-a-fair-contract-for-customers), and [digital content consumer rights](https://www.gov.uk/government/news/new-rights-for-consumers-when-buying-digital-content). Consumer remedies are preserved, rather than replaced by a blanket no-refunds term or broad liability waiver.

## Verification

The new route passed ESLint in the website checkout. Vercel production builds passed compilation and TypeScript checks. Browser verification caught a relative canonical URL resolving to the deployment hostname; the final source uses the absolute requested public URL. Deployment promotion and final public checks are recorded below when completed.

## Published result

- Promoted deployment: `dpl_7f5iyRfrZvxVs4vJzHN2YgT2TSY7` (`portfolio-9h1fivp2t-craig-beswethericks-projects.vercel.app`).
- Public URL: https://roobsworld.com/riddle-quest/terms — unauthenticated GET returns **HTTP 200**, with no redirect or login requirement.
- Source page SHA-256: `6b4d4fb4ecae227e9cdd0dbb8c1d3099fe84557d92894927342cf03048e06fc5`.
- Final deployment passed compilation and TypeScript. Before promotion, the protected deployment passed browser checks at 1440px and 390px widths. After promotion, repeated those checks in a fresh public context: all ten terms sections and verified company/contact details present, correct absolute canonical, no horizontal overflow, zero page errors.
- Existing `/` and `/privacy` each returned HTTP 200 before and after promotion.
- Screenshots: `/tmp/roobs-terms-evidence/preview-1440.png`, `preview-390.png`, `live-1440.png`, `live-390.png`.
- Build log: `/tmp/roobs-terms-publish-deploy.log`.
- This resolves the Facebook terms-URL 404 blocker. It does not complete Meta audience declarations, IARC certification, partner review, payment activation or purchase/refund verification.
