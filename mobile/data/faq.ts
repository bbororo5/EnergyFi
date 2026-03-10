export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: 'When are dividends paid?',
    answer: 'Dividends are calculated based on the last day of each month and paid within the first 5 business days of the following month. The exact payment date may vary depending on the securities firm processing schedule.',
  },
  {
    question: 'Is early redemption possible?',
    answer: 'This product has limited liquidity. Early redemption may be possible through the secondary market on the partner securities platform, subject to market conditions and available buyers.',
  },
  {
    question: 'What happens if a charging station fails?',
    answer: 'All portfolios include regular inspections and maintenance schedules. In case of equipment failure, our operations team dispatches repair within 24 hours. Revenue impact is typically minimal due to portfolio diversification across multiple stations.',
  },
  {
    question: "Why can't I invest directly in the app?",
    answer: 'STOs (Security Tokens) are regulated financial instruments under Korean securities law. All investment transactions must be conducted through our licensed partner securities firm to ensure compliance with KYC/AML requirements.',
  },
  {
    question: 'How often is the data updated?',
    answer: 'Charging data is collected in real-time from hardware-verified stations. Revenue figures are updated after settlement completion, typically within 24-48 hours of the charging session.',
  },
];
