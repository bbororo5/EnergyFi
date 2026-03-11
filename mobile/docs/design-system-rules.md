# Mobile Design System Rules

## Section Titles

- Section titles in tab screens must stay on one line.
- Section titles use a title-only pattern. Do not add a separate eyebrow line above them.
- The canonical style is the Explore section title `Live region stories`.
- Section titles use the dedicated `typography.sectionTitle` token in [`theme.ts`](/Users/jeonseon-ung/Documents/github/EnergyFi/mobile/constants/theme.ts): `26 / 600` with a tighter Apple-style title rhythm.
- Section titles align to the card boundary line, not the inner card content inset. This keeps section hierarchy visually stronger than the content inside the card.
- Keep the title-to-content gap compact. Prefer `8-12px` between a section title and the first card or list item.
- Do not use manual line breaks to create emphasis in section titles.
- Shorten the wording before shrinking the font, adding symbols, or letting the title wrap.
- Move extra context into intro/body copy, not the title line.
- Prefer concise titles such as `Record vs payout`, `Latest region pattern`, `Partner access`.
- The shared [`SectionHeader`](/Users/jeonseon-ung/Documents/github/EnergyFi/mobile/components/ui/section-header.tsx) is the default pattern for section titles. Custom section labels should visually match its title line.

## Copy Principle

- Titles should read as scan-friendly labels, not explanatory sentences.
- Explanations belong in body copy below the title, not in the title itself.
- If a title needs conjunctions like `and`, `vs`, or long qualifier phrases, shorten it until the user can read it in one glance.
