class FaqItem {
  const FaqItem(this.question, this.answer);
  final String question;
  final String answer;
}

class LegalDoc {
  const LegalDoc({
    required this.title,
    required this.blurb,
    this.paragraphs = const [],
    this.faq,
  });

  final String title;
  final String blurb;
  final List<String> paragraphs;
  final List<FaqItem>? faq;
}

const legalUpdated = '18 August 2026';

const faqItems = <FaqItem>[
  FaqItem(
    'What is Rising Rankers?',
    'Rising Rankers is a learning and scholarship platform. You practice Flash Cards and MCQs, then join paid Live Tests. Strong results can earn an Award balance, which you may request to withdraw after review.',
  ),
  FaqItem(
    'How do the three wallet buckets work?',
    'Deposited is money you add (sandbox in this build). Promo is promotional credit and cannot be withdrawn. Award is scholarship winnings.',
  ),
  FaqItem(
    'Are deposits real money right now?',
    'No. Wallet deposits in this environment are sandbox / test credits. They are not a live payment gateway.',
  ),
  FaqItem(
    'Can I get a refund on a Live Test entry fee?',
    'If a test is cancelled before it starts, the entry fee returns to Deposited. After you complete or auto-submit a test, the fee is not refundable except at operator discretion.',
  ),
  FaqItem(
    'When can I withdraw awards?',
    'Withdrawals require a complete profile, an Award balance at or above the minimum, and no fraud hold. A finance admin reviews each request.',
  ),
  FaqItem(
    'Why did practice lock after a few cards or questions?',
    'A daily free quota applies. You can unlock more with wallet credit for a limited window.',
  ),
  FaqItem(
    'What counts as unfair play?',
    'Multiple accounts, sharing a device or account during a live attempt, automation, copying answers, or leaving the app repeatedly during a test.',
  ),
  FaqItem(
    'How do I report a wrong question?',
    'Open Help & support, choose Question error or Test issue, and include the question text or test name.',
  ),
  FaqItem(
    'How do I contact you?',
    'Signed-in students can raise a ticket under Help & support.',
  ),
  FaqItem(
    'How do I delete my account?',
    'Open a ticket under Account and request deletion. Wallet ledger and payment records may be retained for audit.',
  ),
];

const legalDocs = <LegalDoc>[
  LegalDoc(
    title: 'Terms of use',
    blurb: 'Account rules, Live Tests, and what you agree to by using Rising Rankers.',
    paragraphs: [
      'Rising Rankers is a competitive learning and scholarship product. By creating an account you agree to these terms, Privacy, Contest rules, Wallet terms, Withdrawal terms, and Fair play.',
      'Keep one account per person and accurate profile details. If you are a minor, a parent or guardian should review consent on your profile. We may suspend duplicated, automated, or abusive accounts.',
      'Practice content is for personal exam preparation only. Live Tests require an entry fee. Awards are provisional until finance review and may be voided for fraud.',
      'This build uses sandbox payments. The operator should replace this pack with counsel-reviewed copy before a public paid launch.',
    ],
  ),
  LegalDoc(
    title: 'Privacy',
    blurb: 'What we store and how you can ask for export or deletion.',
    paragraphs: [
      'We store account and profile fields, wallet ledger entries, Live Test attempts, device ids for anti-cheat, sandbox payment references, and support tickets.',
      'Data is used to run the product, prevent abuse, and keep a finance audit trail. We do not sell student profiles to advertisers.',
      'Request export or deletion via Help & support (Account). Money-movement records may be retained where audit rules require it.',
    ],
  ),
  LegalDoc(
    title: 'Refunds',
    blurb: 'When entry fees come back, and when they do not.',
    paragraphs: [
      'Sandbox deposits are test credits and are not bank refunds.',
      'Cancelled tests before start return the entry fee to Deposited. Completed or auto-submitted attempts are not refundable except for confirmed platform outages.',
      'Practice unlocks are consumed when quota is granted. Award withdrawals are payouts, not refunds; rejected requests return Award to your wallet.',
    ],
  ),
  LegalDoc(
    title: 'Scholarship & contest rules',
    blurb: 'Live Tests, scoring, and provisional awards.',
    paragraphs: [
      'Joining a Live Test deducts the entry fee and is a contest entry. Scoring follows that test’s marks and negative mark.',
      'Awards are provisional until finance approval. Cheating, device mismatch, or speed anomalies can void an attempt and change ranks.',
      'The operator may cancel or reschedule a test. Cancelled tests refund entry fees to Deposited.',
    ],
  ),
  LegalDoc(
    title: 'Wallet terms',
    blurb: 'Deposited, Award, and Promo balances.',
    paragraphs: [
      'Deposited holds sandbox top-ups. Promo is non-withdrawable credit. Award holds scholarship winnings.',
      'The ledger is the source of truth. We may freeze a wallet when fraud or duplicate-account risk appears.',
    ],
  ),
  LegalDoc(
    title: 'Withdrawal terms',
    blurb: 'Who can request a payout, and how review works.',
    paragraphs: [
      'You may withdraw only from Award, at or above the minimum, with a complete profile and a UPI or bank destination.',
      'Finance reviews each request. This MVP has no live payout rail — approved means accepted in the admin console.',
      'We may reject incomplete details, fraud holds, or suspected contest abuse. Pending requests can be cancelled if an award is later reversed.',
    ],
  ),
  LegalDoc(
    title: 'About Rising Rankers',
    blurb: 'What the product is, and what this build is for.',
    paragraphs: [
      'Students practise with Flash Cards and MCQs, then join Live Tests. Fair, strong performances can earn Award credit.',
      'This Day-1 MVP uses JWT auth and sandbox payments. Use Help & support so issues land in the same queue production will use.',
    ],
  ),
  LegalDoc(
    title: 'Contact',
    blurb: 'How to reach support.',
    paragraphs: [
      'Open Help & support, pick a category, and describe what happened. Include test names, amounts, and timestamps when you can.',
      'There is no public phone line in this MVP. Do not send passwords or full bank numbers in a ticket.',
    ],
  ),
  LegalDoc(
    title: 'FAQ',
    blurb: 'Short answers on wallet, tests, refunds, and support.',
    faq: faqItems,
  ),
  LegalDoc(
    title: 'Fair play',
    blurb: 'Device bind, one account, and cheating.',
    paragraphs: [
      'One person, one account, one bound device per Live Test attempt.',
      'Repeated app switches, a different device, impossible speed, or shared answers can void results and restrict withdrawals.',
      'If a flag looks wrong, open a Test issue ticket. Do not create a second account.',
    ],
  ),
];
