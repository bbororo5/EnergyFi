export type DocumentType = 'terms' | 'privacy' | 'risk' | 'operator';

export const documentTitles: Record<DocumentType, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  risk: 'Risk Disclosures',
  operator: 'Operator Information',
};

export const documentContents: Record<DocumentType, string> = {
  terms: `**Terms of Service**

Last Updated: March 1, 2026

**Article 1. Purpose**

These Terms of Service govern the use of the EnergyFi platform ("Service") provided by EnergyFi Inc. ("Company"). By accessing or using the Service, you agree to be bound by these Terms.

**Article 2. Definitions**

1. "Platform" refers to the EnergyFi mobile application and related services.
2. "User" refers to any individual who accesses or uses the Platform.
3. "Security Token" refers to blockchain-based securities representing fractional ownership of EV charging infrastructure revenue.
4. "Partner Securities Firm" refers to the licensed securities company through which investment transactions are conducted.

**Article 3. Nature of Service**

The Platform provides information about EV charging infrastructure investments. The Platform does NOT facilitate direct investment transactions. All investment activities are conducted through licensed partner securities firms in compliance with applicable securities regulations.

**Article 4. User Obligations**

Users shall not: (a) use the Service for unlawful purposes; (b) attempt to gain unauthorized access; (c) reproduce or distribute content without permission; (d) provide false information during registration.

**Article 5. Disclaimer**

The Company provides information on an "as-is" basis. Past performance does not guarantee future results. Investment decisions should be made after careful consideration of all relevant factors and consultation with qualified financial advisors.`,

  privacy: `**Privacy Policy**

Last Updated: March 1, 2026

**1. Personal Information Collected**

We collect the following categories of personal information:
- Account information: name, email, phone number
- Device information: device model, OS version, unique identifiers
- Usage data: app interactions, feature usage, session duration
- Location data: approximate location (with consent)

**2. Purpose of Collection**

Personal information is used for: account management, service improvement, security monitoring, legal compliance, and communication about service updates.

**3. Retention Period**

Personal information is retained for the duration of the account relationship plus 5 years, or as required by applicable law (Electronic Financial Transactions Act: 5 years).

**4. Third Party Provision**

We may share information with: partner securities firms (for KYC/AML), cloud infrastructure providers, analytics services. We do not sell personal information.

**5. User Rights**

Users may request: access to personal data, correction of inaccurate data, deletion of data (subject to legal retention requirements), restriction of processing, data portability.

**6. Privacy Officer**

Name: Young-hee Kim
Email: privacy@energyfi.com
Address: 123 Teheran-ro, Gangnam-gu, Seoul`,

  risk: `**Risk Disclosures**

Last Updated: March 1, 2026

**1. Risk of Principal Loss**

Investment in EV charging infrastructure security tokens carries the risk of partial or total loss of invested capital. Returns are not guaranteed and depend on actual charging revenue performance.

**2. Demand Volatility**

EV charging demand may fluctuate due to: seasonal variations, changes in EV adoption rates, competing infrastructure, economic conditions, and government policy changes.

**3. Operational Risk**

Charging stations may experience: equipment failures, power outages, maintenance downtime, vandalism, or natural disasters that reduce revenue generation.

**4. Liquidity Risk**

Security tokens may have limited secondary market liquidity. Investors may not be able to sell their holdings at desired prices or timeframes.

**5. Electricity Fee Risk**

Changes in electricity pricing, time-of-use rates, or utility regulations may impact operational costs and reduce net revenue.

**6. Technology Risk**

Blockchain technology, smart contracts, and hardware components may contain vulnerabilities or experience failures that could affect service operation.

**7. Regulatory Risk**

Changes in securities regulations, cryptocurrency laws, EV policies, or tax treatment may adversely affect the investment.

**Investor Cautions**

Please invest only amounts you can afford to lose. Diversify your investments. Read all documentation carefully before investing. Consult with a qualified financial advisor.

Contact: 1588-0000`,

  operator: `**Operator Information**

**Company Name:** EnergyFi Inc.
**CEO:** Jun-young Park
**Established:** June 15, 2022
**Registration:** 123-45-67890

**Address:** 123 Teheran-ro, Gangnam-gu, Seoul, EnergyFi Building 5F
**Phone:** 1588-0000
**Email:** contact@energyfi.com
**Website:** energyfi.com

**Licenses & Certifications**

1. FSC Fintech Innovation License (2023)
2. ISMS (Information Security Management System) Certified
3. ISO 27001 Information Security Certified
4. ISO 14001 Environmental Management Certified

**Partner Securities Firms**

1. Korea Investment & Securities
2. Samsung Securities
3. NH Investment & Securities
4. KB Securities

**External Auditor**

Samjong KPMG
Audit Frequency: Quarterly
Latest Audit: Q4 2025 (Clean Opinion)

**Dispute Resolution**

For complaints or disputes, contact our customer service team at 1588-0000 or file through the Korea Financial Investment Association (KOFIA) dispute resolution center.`,
};
