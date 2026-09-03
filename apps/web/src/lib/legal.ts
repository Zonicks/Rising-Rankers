export type LegalPage = {
  slug: string;
  title: string;
  blurb: string;
  paragraphs: string[];
};

export type FaqItem = { q: string; a: string };

export const LEGAL_UPDATED = "18 August 2026";

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Rising Rankers?",
    a: "Rising Rankers is a learning and scholarship platform. You practice Flash Cards and MCQs, then join paid Live Tests. Strong results can earn an Award balance, which you may request to withdraw after review.",
  },
  {
    q: "How do the three wallet buckets work?",
    a: "Deposited is money you add (sandbox in this build). Promo is promotional credit and cannot be withdrawn. Award is scholarship winnings. Live Test entry fees are taken from Deposited first, then Promo if needed, depending on product rules at the time of join.",
  },
  {
    q: "Are deposits real money right now?",
    a: "No. Wallet deposits in this environment are sandbox / test credits. They are not a live payment gateway. Do not send real bank or UPI transfers expecting them to appear here.",
  },
  {
    q: "Can I get a refund on a Live Test entry fee?",
    a: "If a test is cancelled before it starts, the entry fee returns to Deposited. After you complete or auto-submit a test, the fee is not refundable except at operator discretion (for example a platform outage).",
  },
  {
    q: "When can I withdraw awards?",
    a: "Withdrawals require a complete profile, an Award balance at or above the minimum, and no fraud hold. A finance admin reviews each request. Promo and unused Deposited balances are not withdrawable as scholarship payouts.",
  },
  {
    q: "Why did practice lock after a few cards or questions?",
    a: "A daily free quota applies. You can unlock more with wallet credit for a limited window. Unlock prices and quotas are set in admin settings.",
  },
  {
    q: "What counts as unfair play?",
    a: "Multiple accounts, sharing a device or account during a live attempt, automation, copying answers, or leaving the app repeatedly during a test. Results may be voided and awards withheld.",
  },
  {
    q: "How do I report a wrong question?",
    a: "Open Help & support, choose “Question error” or “Test issue”, and include the question text or test name. Content staff can correct or deactivate items.",
  },
  {
    q: "How do I contact you?",
    a: "Signed-in students can raise a ticket under Help & support. Categories cover Payment, Wallet, Withdrawal, Question error, Test issue, Account, Privacy, and Other. Privacy tickets are grievances with a 90-day close target.",
  },
  {
    q: "How do I delete my account?",
    a: "Open a ticket under Privacy or Account and ask for deletion. Admin starts a 48-hour notice, then anonymises the profile. Wallet ledger and login logs may be retained where finance, tax, or CERT-In rules require it.",
  },
];

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: "terms",
    title: "Terms of use",
    blurb: "Account rules, Live Tests, and what you agree to by using Rising Rankers.",
    paragraphs: [
      "Rising Rankers (“the platform”) is a competitive learning and scholarship product. These terms apply to the student web app, the mobile app, and related admin tools. By creating an account you agree to this document, the Privacy policy, Contest rules, Wallet terms, Withdrawal terms, and Fair play rules.",
      "You must provide accurate profile details and keep one account per person. If you are a minor, a parent or guardian should review these terms and the consent checkbox on your profile. We may suspend or close accounts that look duplicated, automated, or abusive.",
      "Practice content (Flash Cards and MCQs) is licensed for personal exam preparation only. You may not scrape, republish, or sell questions. Live Tests require an entry fee from your wallet. Joining a test is a binding contest entry under the Contest rules.",
      "Awards shown after a test are provisional until finance review. The operator may withhold, reverse, or void results when fraud flags, device mismatches, or scoring errors appear. Rankings and pools can change if entries are disqualified.",
      "The current build uses sandbox payments. Nothing here is an offer of a regulated prize competition in every jurisdiction. The operator will replace these terms with counsel-reviewed copy before a public, paid launch.",
      "We may update features, quotas, and fees. Continued use after a posted update counts as acceptance. If you do not agree, stop using the product and request account closure via support.",
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    blurb: "What we store, why we store it, and how you can ask for export or deletion.",
    paragraphs: [
      "We collect account data (email, name, password hash), profile fields (mobile, class or exam, city, state, date of birth, parent or guardian, consent), wallet and ledger entries, Live Test attempts and answers, device session identifiers used for anti-cheat, sandbox payment references, and support tickets.",
      "We use this data to run the product, score tests, move wallet balances, investigate fraud, answer support tickets, and keep a finance audit trail. We do not sell student profiles to advertisers.",
      "Anti-cheat processing includes a device id bound to your account during a live attempt and counts of app switches. That data is used to flag suspicious sessions, not to track you across unrelated apps.",
      "Access is limited by role: content staff see questions and error reports; finance staff see withdrawals and ledgers; support staff see tickets; super admins see operational reports. Read-only roles cannot change records.",
      "You can request an export or deletion through Help & support (category Privacy). Money-movement, award, and login records may be kept for the retention period required for audit even if the rest of the profile is removed.",
      "A named Grievance Officer is published on Help & support when configured in admin Settings. Privacy grievances have a 90-day close target before you escalate to the Data Protection Board.",
    ],
  },
  {
    slug: "refunds",
    title: "Refunds",
    blurb: "When entry fees come back, and when they do not.",
    paragraphs: [
      "Sandbox deposits are test credits. They are not real-money purchases and are not eligible for a bank or card refund.",
      "If a Live Test is cancelled before it starts, the entry fee is returned to your Deposited balance. If the operator postpones a test, the fee stays applied to the new slot unless we cancel the event.",
      "Completed, timed-out, or auto-submitted attempts are not refundable. We may reverse an entry fee at our discretion when a confirmed platform outage prevented you from playing a fair test.",
      "Unlock purchases for extra Flash Cards or MCQs are consumed when the quota is granted. They are not refunded because you finished the pack early or disliked a question. Report content errors instead; we can fix or retire items.",
      "Award withdrawals are not refunds. They are payouts of scholarship winnings after review. Rejected withdrawals return the Award balance to your wallet.",
    ],
  },
  {
    slug: "contest-rules",
    title: "Scholarship & contest rules",
    blurb: "How Live Tests, entry fees, scoring, and provisional awards work.",
    paragraphs: [
      "A Live Test is a timed, paid contest. The listing shows title, schedule, duration, entry fee, marking scheme, and (where shown) a minimum award pool. Joining deducts the entry fee and places you in the waiting room until start.",
      "Scoring uses the marks per correct answer and negative mark published for that test. Unanswered items score zero. Ties may share rank. The operator may void an attempt that fails device bind, exceeds app-switch limits, or shows speed anomalies.",
      "Award pools and individual awards are provisional until finance approval. Disqualified entries can change ranks and payouts. You have no guaranteed prize until a withdrawal is approved or an award is otherwise confirmed in the ledger.",
      "You must sit the test yourself, on one bound device, without sharing questions during the window. Coaching, bots, answer keys, and second accounts are cheating under Fair play.",
      "The operator can cancel, reschedule, or merge tests when turnout, content, or integrity issues require it. Cancelled tests refund entry fees to Deposited as described in Refunds.",
    ],
  },
  {
    slug: "wallet-terms",
    title: "Wallet terms",
    blurb: "Deposited, Award, and Promo balances, and how they are used.",
    paragraphs: [
      "Every student wallet has three buckets: Deposited, Award, and Promo. Amounts are stored on a ledger. The UI totals are summaries of that ledger, not a separate bank account.",
      "Deposited holds sandbox top-ups (and, later, real gateway deposits). Promo holds non-withdrawable promotional credit. Award holds scholarship winnings after tests are settled.",
      "Live Test entry fees and practice unlocks spend wallet credit according to product rules. Promo cannot be withdrawn as cash. Award cannot be used as a substitute for Deposited unless a specific product rule says otherwise.",
      "Ledger entries are the source of truth for disputes. If a display total and the ledger disagree, the ledger wins after support review.",
      "We may freeze a wallet when fraud flags, duplicate accounts, or withdrawal risk appear. Frozen funds stay on the ledger until the case is resolved.",
    ],
  },
  {
    slug: "withdrawal-terms",
    title: "Withdrawal terms",
    blurb: "Who can request a payout, and how review works.",
    paragraphs: [
      "You may request a withdrawal only from Award balance, at or above the minimum amount, with a complete profile and a destination (UPI id or bank details). Deposited and Promo balances are not scholarship payouts.",
      "Requests start as pending. Finance or a super admin reviews them. Approved requests are marked paid in this MVP (no live payout rail yet). Rejected requests return Award to your wallet with a reason where provided.",
      "We may reject or delay a withdrawal for incomplete KYC-style details, fraud holds, mismatched names, duplicate accounts, or suspected contest abuse. Passing an automated check does not guarantee approval.",
      "Until a real payout provider is connected, “approved” means the operator accepted the request in the admin console. Do not treat sandbox approvals as money in a bank.",
      "Chargebacks, clawbacks, or reversed awards (for example after a late disqualification) can reduce Award even after a pending request is filed. Pending requests may be cancelled in that case.",
    ],
  },
  {
    slug: "about",
    title: "About Rising Rankers",
    blurb: "What the product is, and what this build is for.",
    paragraphs: [
      "Rising Rankers is a competitive learning and scholarship platform. Students practise with Flash Cards and MCQs, then join Live Tests. Strong, fair performances can earn Award credit.",
      "The student surfaces are a Flutter app and a Next.js web app. Staff use a separate admin console for content, tests, withdrawals, fraud, and support.",
      "This repository is a Day-1 style MVP: JWT auth (OTP not wired), sandbox payments, and local hosting. It is meant to prove the learning, contest, wallet, and integrity loops — not to take public real-money deposits yet.",
      "If you are evaluating the product, use the in-app Help & support ticket so issues land in the same queue as production support will use.",
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    blurb: "How to reach support for payments, tests, and account issues.",
    paragraphs: [
      "The fastest path is in-app Help & support. Sign in, open Support, pick a category, and describe what happened. Include test names, amounts, and timestamps when you can.",
      "Categories: Payment, Wallet, Withdrawal, Question error, Test issue, Account, Privacy, Other. Tickets appear in the admin support queue for staff to update (open, in progress, resolved, closed).",
      "There is no public phone line in this MVP. Do not send passwords, OTPs, or full bank account numbers in a ticket body if a UPI id or last-four digits will do.",
      "For legal notices related to a future public operator, use the same Account ticket until a registered address is published here.",
    ],
  },
  {
    slug: "fair-play",
    title: "Fair play",
    blurb: "Device bind, one account, and what happens if you cheat.",
    paragraphs: [
      "Fair play is required for every Live Test and for the integrity of scholarship awards. One person, one account, one bound device per attempt.",
      "During a live attempt you should stay in the test. Repeated app switches, a different device id, impossible speed, or shared answer patterns can create fraud flags. Staff may void the attempt, withhold Award, restrict withdrawals, or close the account.",
      "Practice mode is for learning. Harvesting the bank to build an answer key, scripting the API, or selling our questions is still abuse and can lead to a ban.",
      "If you think a flag is wrong, open a Test issue ticket. Do not create a second account to “try again” — that usually makes the case worse.",
    ],
  },
];

export const LEGAL_BY_SLUG: Record<string, LegalPage> = Object.fromEntries(
  LEGAL_PAGES.map((p) => [p.slug, p])
);

export const LEGAL_INDEX = [
  ...LEGAL_PAGES.map((p) => ({ href: `/legal/${p.slug}`, title: p.title, blurb: p.blurb })),
  { href: "/legal/faq", title: "FAQ", blurb: "Short answers on wallet, tests, refunds, and support." },
  { href: "/app/support", title: "Help & support", blurb: "Raise a ticket (sign-in required)." },
];
