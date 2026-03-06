# Doc 5: UI Specification

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v1.0
> **Date**: 2026-03-06
> **Dependency**: Doc 4 (Persona) → Doc 1 (Journey Map) → Doc 2 (IA) → Doc 3 (State Machine) → **This Document**

> **Design Assumption**: The hackathon prototype assumes **Path A** (tokens issued on EnergyFi L1).
> The production issuance path (Path A / B / CCIP) will be determined after the Presidential Decree
> is finalized and a securities firm partnership is established. The "My Portfolio" tab's data source
> may change depending on the chosen path.

---

## 1. Design Principles

Six principles govern all visual decisions. Each traces to a persona insight (Doc 4) or journey requirement (Doc 1).

| # | Principle | Origin | Implication |
|:--|:--|:--|:--|
| P1 | **Trust-First** | Persona: "Is this real?" anxiety | Muted professional palette. No flashy gradients. Green = verified. |
| P2 | **Data Density** | Journey Phase 5: 30-second morning check | Numbers are hero elements. Large financial amounts above the fold. |
| P3 | **Progressive Revelation** | Doc 4 §6: L1/L2/L3 levels | Summary cards → detail screens → raw verification. Never overwhelm. |
| P4 | **Platform Consistency** | Persona: Toss/Kiwoom native user | System font, native gestures, platform-standard navigation. |
| P5 | **Accessibility** | Persona: commute usage (bright sunlight, one-handed) | 48px touch targets, 4.5:1 contrast, arrow+color for gain/loss. |
| P6 | **Hackathon Pragmatism** | Constraint: timeline + team size | StyleSheet-only, no external UI library. react-native-reanimated for animation. |

---

## 2. Design Tokens

All visual values are centralized as tokens. Implementation file: `frontend/constants/theme.ts`.

### 2.1 Color Palette

#### Semantic Colors

| Token | Light | Dark | Usage |
|:--|:--|:--|:--|
| `primary` | `#0066FF` | `#4D94FF` | Active tab, links, primary buttons |
| `primaryLight` | `#E6F0FF` | `#1A3366` | Primary button hover/pressed background |
| `background` | `#FFFFFF` | `#121212` | Screen background |
| `surface` | `#F7F8FA` | `#1E1E1E` | Card backgrounds |
| `surfaceElevated` | `#FFFFFF` | `#2A2A2A` | Elevated cards, modals, bottom sheets |
| `text` | `#11181C` | `#ECEDEE` | Primary text |
| `textSecondary` | `#687076` | `#9BA1A6` | Descriptions, secondary labels |
| `textTertiary` | `#A0A7AD` | `#5C6368` | Timestamps, placeholders, disabled |
| `border` | `#E8EBED` | `#333333` | Card borders, dividers |
| `borderLight` | `#F2F3F5` | `#2A2A2A` | Subtle separators |

#### Trust Colors

| Token | Light | Dark | Usage |
|:--|:--|:--|:--|
| `verified` | `#16A34A` | `#22C55E` | Verified badge checkmark |
| `verifiedBg` | `#F0FDF4` | `#052E16` | Verified badge background |
| `verifiedText` | `#15803D` | `#86EFAC` | Verified badge label text |

#### Financial Colors (Locale-Dependent)

| Token | Light | Dark | Locale | Usage |
|:--|:--|:--|:--|:--|
| `gainEN` | `#16A34A` | `#22C55E` | EN | Positive change |
| `lossEN` | `#DC2626` | `#EF4444` | EN | Negative change |
| `gainKR` | `#DC2626` | `#EF4444` | KR | Positive change |
| `lossKR` | `#2563EB` | `#60A5FA` | KR | Negative change |

> **Rule** (Doc 4 §8.1): Gain/loss colors swap between EN and KR locales. Arrow indicators (↑/↓) always accompany color for colorblind accessibility.

#### Status Colors

| Token | Light | Dark | Usage |
|:--|:--|:--|:--|
| `warning` | `#F59E0B` | `#FBBF24` | Stale data timestamp |
| `warningBg` | `#FFFBEB` | `#451A03` | Warning banner background |
| `error` | `#DC2626` | `#EF4444` | Error text, icons |
| `errorBg` | `#FEF2F2` | `#450A0A` | Error/offline banner background |
| `info` | `#0066FF` | `#4D94FF` | Info banners |
| `infoBg` | `#E6F0FF` | `#1A3366` | Info banner background |

#### Skeleton Colors

| Token | Light | Dark | Usage |
|:--|:--|:--|:--|
| `skeleton` | `#E8EBED` | `#333333` | Skeleton base |
| `skeletonHighlight` | `#F7F8FA` | `#444444` | Shimmer highlight |

#### Navigation Colors

| Token | Light | Dark | Usage |
|:--|:--|:--|:--|
| `tabBarBg` | `#FFFFFF` | `#121212` | Tab bar background |
| `tabBarBorder` | `#E8EBED` | `#333333` | Tab bar top border |
| `tabActive` | `#0066FF` | `#4D94FF` | Active tab icon + label |
| `tabInactive` | `#687076` | `#9BA1A6` | Inactive tab icon + label |

### 2.2 Typography Scale

System font only — no custom font loading required. Platform fonts via `constants/theme.ts` `Fonts` object.

| Variant | Size (px) | Weight | Line Height (px) | Letter Spacing | Usage |
|:--|:--|:--|:--|:--|:--|
| `display` | 28 | 700 (Bold) | 34 | -0.5 | Portfolio total amount, hero numbers |
| `heading1` | 22 | 700 (Bold) | 28 | -0.3 | Screen titles ("My Portfolio", "Explore") |
| `heading2` | 18 | 600 (SemiBold) | 24 | 0 | Section headers ("Stations", "Revenue") |
| `heading3` | 16 | 600 (SemiBold) | 22 | 0 | Card titles (region name, station ID) |
| `body` | 15 | 400 (Regular) | 22 | 0 | Body text, descriptions, menu items |
| `bodyBold` | 15 | 600 (SemiBold) | 22 | 0 | Emphasized body (card values) |
| `caption` | 13 | 400 (Regular) | 18 | 0 | Timestamps, secondary labels |
| `captionBold` | 13 | 600 (SemiBold) | 18 | 0 | Badge labels, tab labels, chip text |
| `overline` | 11 | 600 (SemiBold) | 16 | 1.0 | Category labels (uppercase) |
| `mono` | 13 | 400 (Regular) | 18 | 0 | Hex signatures, Merkle root, addresses (L3 only) |

**Font family mapping** (from existing `Fonts` constant):
- `sans`: System UI (San Francisco on iOS, Roboto on Android)
- `mono`: SFMono-Regular / Menlo / monospace (L3 verification data only)

### 2.3 Spacing Scale

4px base unit. 8px primary grid.

| Token | Value (px) | Usage |
|:--|:--|:--|
| `xxs` | 2 | Micro gap: icon-to-text inline |
| `xs` | 4 | Inline element gaps, badge padding vertical |
| `sm` | 8 | Compact padding, chip gaps, list item separator |
| `md` | 12 | Card internal padding (tight), badge padding horizontal |
| `lg` | 16 | Card padding (standard), section spacing |
| `xl` | 24 | Between-card gap, section dividers |
| `xxl` | 32 | Screen horizontal padding, major section gaps |
| `xxxl` | 48 | Screen top safe area, bottom navigation clearance |

### 2.4 Border Radius

| Token | Value (px) | Usage |
|:--|:--|:--|
| `sm` | 6 | Badges, small chips, progress bars |
| `md` | 12 | Cards, buttons, inputs, chart containers |
| `lg` | 16 | Large cards, modal corners |
| `xl` | 24 | Bottom sheets |
| `round` | 9999 | Circular elements (status dots, avatar) |

### 2.5 Shadows / Elevation

Cross-platform shadow system:

| Level | iOS (shadowColor, offset, opacity, radius) | Android (elevation) | Usage |
|:--|:--|:--|:--|
| `none` | — | 0 | Flat cards (cards on `surface` bg) |
| `sm` | `#000`, {0, 1}, 0.06, 2 | 2 | Subtle lift: inactive cards |
| `md` | `#000`, {0, 2}, 0.08, 4 | 4 | Primary cards: RegionCard, StationCard |
| `lg` | `#000`, {0, 4}, 0.12, 8 | 8 | Floating: modals, dropdowns, bottom sheets |

**Implementation**: Cross-platform `shadow()` helper function:

```typescript
import { Platform, ViewStyle } from 'react-native';

export function shadow(level: 'none' | 'sm' | 'md' | 'lg'): ViewStyle {
  const config = { none: [0,0,0], sm: [1,0.06,2], md: [2,0.08,4], lg: [4,0.12,8] };
  const [offset, opacity, radius] = config[level];
  return Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: offset }, shadowOpacity: opacity, shadowRadius: radius },
    android: { elevation: radius },
    default: { shadowColor: '#000', shadowOffset: { width: 0, height: offset }, shadowOpacity: opacity, shadowRadius: radius },
  }) as ViewStyle;
}
```

### 2.6 Icon System

All icons from `@expo/vector-icons` (already installed). Primary set: **MaterialIcons**.

| Concept | Icon Name | Size | Usage |
|:--|:--|:--|:--|
| Portfolio tab | `pie-chart` | 24 | Bottom tab |
| Explore tab | `explore` | 24 | Bottom tab |
| More tab | `more-horiz` | 24 | Bottom tab |
| Verified checkmark | `check-circle` | 16 | VerifiedBadge |
| Station | `ev-station` | 20 | Station cards, headers |
| Charger | `electrical-services` | 18 | Charger spec rows |
| Revenue trend | `trending-up` | 20 | Revenue section headers |
| Gain arrow | `arrow-upward` | 14 | PercentageChange positive |
| Loss arrow | `arrow-downward` | 14 | PercentageChange negative |
| Back navigation | `arrow-back-ios` | 20 | ScreenHeader |
| Sort | `sort` | 20 | Region list sort picker |
| Refresh | `refresh` | 20 | Manual refresh, stale indicator |
| Settings | `settings` | 22 | More menu item |
| Guide/book | `menu-book` | 22 | More menu item |
| Verification | `verified` | 22 | More menu item |
| Info | `info-outline` | 22 | More menu item, About |
| Warning | `warning` | 20 | Error states |
| Offline | `wifi-off` | 18 | Offline banner |
| External link | `open-in-new` | 16 | Block Explorer links (L3) |
| Lock | `lock-outline` | 40 | Auth gate illustration |
| Energy bolt | `bolt` | 18 | Session cards, energy display |
| Calendar | `calendar-today` | 16 | Date displays, settlement period |

### 2.7 Motion Tokens

| Token | Value | Usage |
|:--|:--|:--|
| `durationFast` | 150ms | Button press feedback, badge text change |
| `durationNormal` | 200ms | Skeleton→content fade, state transitions |
| `durationSlow` | 300ms | Error→content transition, sheet open |
| `durationChart` | 600ms | Chart bar growth animation |
| `shimmerCycle` | 1200ms | Skeleton shimmer loop duration |
| `easingStandard` | Easing.bezier(0.4, 0, 0.2, 1) | Standard easing for most transitions |
| `easingDecelerate` | Easing.out(Easing.cubic) | Chart entrance, content appearance |

---

## 3. Component Library

Every reusable component with TypeScript props, visual states, and dimensions.

### 3.1 Layout Components

#### ScreenContainer

Wraps every screen. Provides SafeArea, scroll, and pull-to-refresh.

```typescript
interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;           // default: true
  refreshing?: boolean;           // pull-to-refresh state
  onRefresh?: () => void;         // pull-to-refresh handler
  padding?: boolean;              // default: true (applies xxl horizontal padding)
  backgroundColor?: string;       // override background color
}
```

- Wraps `SafeAreaView` + `ScrollView` (or `View` if `scrollable=false`)
- Pull-to-refresh uses native `RefreshControl`
- Default horizontal padding: `spacing.xxl` (32px)

#### SectionHeader

Section title with optional navigation link.

```typescript
interface SectionHeaderProps {
  title: string;                  // Section title (heading2)
  actionLabel?: string;           // e.g., "View all"
  onAction?: () => void;          // Navigation handler
}
```

- Layout: `title` left-aligned, `actionLabel →` right-aligned
- Title: `heading2` variant
- Action: `caption` variant, `primary` color, with `→` suffix
- Bottom margin: `spacing.lg` (16px)

#### Divider

```typescript
interface DividerProps {
  spacing?: number;               // vertical margin above and below (default: spacing.lg)
}
```

- 1px `borderLight` colored line
- Default 16px margin above and below

#### Spacer

```typescript
interface SpacerProps {
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}
```

### 3.2 Data Display Components

#### CurrencyDisplay

Locale-aware Korean Won rendering. Implements Doc 4 §8.1 rules.

```typescript
interface CurrencyDisplayProps {
  amount: number;                 // Raw KRW value (integer)
  size?: 'lg' | 'md' | 'sm';     // default: 'md'
  color?: string;                 // override text color
}
```

| Size | Typography Variant | Example (EN) | Example (KR) |
|:--|:--|:--|:--|
| `lg` | `display` (28px) | `₩13,570,000` | `13,570,000원` |
| `md` | `bodyBold` (15px) | `₩13,570,000` | `13,570,000원` |
| `sm` | `caption` (13px) | `₩13,570,000` | `13,570,000원` |

**Formatting**: Uses `Intl.NumberFormat('ko-KR')` for comma separation. Symbol placement differs by locale.

#### PercentageChange

Gain/loss display with locale-aware colors and mandatory arrow.

```typescript
interface PercentageChangeProps {
  value: number;                  // e.g., 12.3 or -5.2
  showArrow?: boolean;            // default: true
  size?: 'md' | 'sm';            // default: 'md'
}
```

| State | EN Locale | KR Locale |
|:--|:--|:--|
| Positive (+12.3%) | `↑ +12.3%` in `gainEN` (green) | `↑ +12.3%` in `gainKR` (red) |
| Negative (-5.2%) | `↓ -5.2%` in `lossEN` (red) | `↓ -5.2%` in `lossKR` (blue) |
| Zero (0.0%) | `0.0%` in `textSecondary` | `0.0%` in `textSecondary` |

- Arrow icon: `arrow-upward` (14px) or `arrow-downward` (14px)
- Size `md`: `bodyBold`, Size `sm`: `captionBold`

#### StatRow

Horizontal label-value pair. Used throughout detail screens.

```typescript
interface StatRowProps {
  label: string;                  // Left side (caption, textSecondary)
  value: string | ReactNode;      // Right side (bodyBold, text)
  onPress?: () => void;           // Optional: makes row tappable
}
```

- Layout: `flexDirection: 'row'`, `justifyContent: 'space-between'`
- Height: 44px (meets 48px touch target with vertical padding)
- If `onPress`: add right chevron icon

#### DataTimestamp

Relative time display tied to data freshness.

```typescript
interface DataTimestampProps {
  timestamp: Date;                // Last data update time
  variant: 'fresh' | 'stale' | 'error';
}
```

| Variant | Text | Color |
|:--|:--|:--|
| `fresh` | "Updated 30s ago" | `textTertiary` |
| `stale` | "Updating..." | `warning` |
| `error` | "Last checked: 5m ago" | `warning` |

- Typography: `caption`
- Relative time: computed from `timestamp` vs `Date.now()`

### 3.3 Trust Components

#### VerifiedBadge

**Core Ambient Trust element** — appears on every data screen (Doc 3 §5).

```typescript
interface VerifiedBadgeProps {
  timestamp: Date;                // Last verification time
  state: 'verified' | 'updating' | 'cached';
  onPress?: () => void;           // L3 drill-down navigation
  compact?: boolean;              // default: false (compact hides label text)
}
```

**Visual States**:

| State | Icon | Label | Timestamp | Background | Border |
|:--|:--|:--|:--|:--|:--|
| `verified` | `check-circle` 16px `verified` | "Hardware Verified" `verifiedText` | "Just updated" / "30s ago" `textTertiary` | `verifiedBg` | none |
| `updating` | `refresh` 16px `textSecondary` (rotating) | "Updating..." `textSecondary` | hidden | `surface` | `border` |
| `cached` | `check-circle` 16px `verified` | "Hardware Verified" `verifiedText` | "5m ago" `warning` | `verifiedBg` | none |

**Dimensions**:
- Height: 32px (standard) / 24px (compact)
- Padding: horizontal `spacing.md` (12px), vertical `spacing.xs` (4px)
- Border radius: `borderRadius.sm` (6px)
- Layout: `flexDirection: 'row'`, `alignItems: 'center'`, icon→label→timestamp with `spacing.xs` gaps

**Animation**: When transitioning between states, crossfade icon and text with `durationFast` (150ms).

#### ViewSourceLink

L2→L3 drill-down trigger.

```typescript
interface ViewSourceLinkProps {
  label?: string;                 // default: "View source data"
  onPress: () => void;
}
```

- Typography: `caption`, `primary` color
- Layout: text + `→` arrow suffix
- No underline
- Placed at bottom of data sections on L2 screens

#### VerificationResult

L3 SE signature verification display.

```typescript
interface VerificationResultProps {
  verified: boolean;              // Verification pass/fail
  signature: string;              // Hex string (truncated display)
  algorithm: 'P-256' | 'secp256k1';
  chipId: string;                 // Charger ID
  enrolledAt: Date;               // Chip enrollment date
  blockExplorerUrl?: string;      // External link
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ Hardware Signature Verification       │  heading3
│                                       │
│ The charger's security chip           │  body, textSecondary
│ directly signed this data.            │
│                                       │
│ Status        ✅ Verified              │  StatRow: verified color
│ Algorithm     P-256                   │  StatRow
│ Chip ID       ELEC-GN-001-C03        │  StatRow
│ Enrolled      Jan 15, 2026           │  StatRow
│                                       │
│ Signature                             │  captionBold
│ 0x3a4b5c6d...cf21ef89               │  mono, textSecondary, full on expand
│                                       │
│ [View on Block Explorer →]            │  ViewSourceLink + external icon
└──────────────────────────────────────┘
```

- Container: `surfaceElevated` background, `borderRadius.md`, `shadow.sm`
- If `verified=false`: status row shows `❌ Invalid` in `error` color (extremely rare edge case)

### 3.4 Card Components

#### RegionCard

Dual-variant card used in both Portfolio and Explore tabs.

```typescript
interface RegionCardProps {
  regionId: string;               // ISO 3166-2:KR code (e.g., "KR-11")
  regionName: string;             // Display name (e.g., "Seoul Metropolitan")
  variant: 'portfolio' | 'explore';
  // Common data
  revenue: number;                // This month's revenue (KRW)
  trancheCount: number;           // Issuance round count
  totalUnits: number;             // Total issued units
  verifiedTimestamp: Date;        // For VerifiedBadge
  // Portfolio variant only
  unitsHeld?: number;             // My units
  sharePercent?: number;          // balanceOf / totalSupply
  momChange?: number;             // Month-over-month % change
  // Explore variant only
  stationCount?: number;
  chargerCount?: number;
  // Interaction
  onPress: () => void;
}
```

**Portfolio Variant Layout**:
```
┌──────────────────────────────────────┐
│ Seoul Metropolitan          500 u    │  heading3 + bodyBold(right)
│ Share: 1.0%                          │  caption, textSecondary
│                                       │
│ ₩1,850,000              ↑ +12.0%    │  bodyBold + PercentageChange
│ Round 3 · 50,000 total units         │  caption, textSecondary
│ ✓ Hardware Verified · 30s ago        │  VerifiedBadge (compact)
└──────────────────────────────────────┘
```

**Explore Variant Layout**:
```
┌──────────────────────────────────────┐
│ Seoul Metropolitan                    │  heading3
│ 42 stations · 156 chargers          │  caption, textSecondary
│                                       │
│ This month: ₩13,570,000             │  bodyBold (label:caption)
│ Round 3 · 50,000 total units         │  caption, textSecondary
│ ✓ Hardware Verified                  │  VerifiedBadge (compact)
└──────────────────────────────────────┘
```

**Dimensions**:
- Width: full (screen width - 2 × `spacing.xxl`)
- Min height: 130px (portfolio) / 120px (explore)
- Padding: `spacing.lg` (16px)
- Background: `surface`
- Border: 1px `border`
- Border radius: `borderRadius.md` (12px)
- Shadow: `shadow.sm`
- Gap between cards: `spacing.md` (12px)

**Press feedback**: `opacity: 0.7` on press via `Pressable`

**Skeleton variant**: Same dimensions, internal content replaced with `SkeletonText` (3 lines) + `SkeletonBox` (badge area)

#### StationCard

```typescript
interface StationCardProps {
  stationId: string;              // e.g., "ELEC-GN-001"
  location: string;               // e.g., "Gangnam Tower B1"
  chargerCount: number;
  active: boolean;
  onPress: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ 🔌 ELEC-GN-001          4 chargers  │  heading3 + caption
│    Gangnam Tower B1     ● Active     │  caption + status dot
└──────────────────────────────────────┘
```

- Height: ~72px
- `ev-station` icon (20px) left of station ID
- Active: green dot (`verified`), Inactive: gray dot (`textTertiary`)
- Background: `surface`, border radius: `borderRadius.md`

#### SessionCard

```typescript
interface SessionCardProps {
  tokenId: number;
  date: Date;
  energyKwh: number;             // kWh (2 decimal: 6.78)
  revenue: number;                // KRW
  vehicleCategory: 'BEV' | 'PHEV' | 'Unknown';
  verified: boolean;
  verifiedTimestamp: Date;
  onPress: () => void;            // Navigate to L3 detail
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ Mar 31, 2026 14:32                   │  captionBold
│                                       │
│ ⚡ 6.78 kWh        ₩14,400          │  body + bodyBold
│ BEV                                  │  caption, textSecondary
│ ✓ Hardware Verified                  │  VerifiedBadge (compact)
│                   [View raw signature →] │  ViewSourceLink
└──────────────────────────────────────┘
```

- Height: ~110px
- Padding: `spacing.lg`
- Background: `surface`, border: 1px `border`, border radius: `borderRadius.md`

#### TrancheCard

```typescript
interface TrancheCardProps {
  trancheId: number;              // 1-based round number
  tokenAmount: number;            // Units issued in this round
  stationCount: number;           // Stations added
  issuedAt: Date;
  onPress?: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ Round 3                 Jan 15, 2026 │  heading3 + caption
│ 20,000 units · 12 stations          │  body
└──────────────────────────────────────┘
```

- Height: ~64px
- Background: `surface`, border radius: `borderRadius.md`

#### AttestationCard

```typescript
interface AttestationCardProps {
  period: string;                 // "March 2026" or "2026.03"
  amount: number;                 // KRW
  stationCount: number;
  finalizedAt: Date;
  onPress: () => void;            // Navigate to L3 settlement report
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ March 2026 Settlement                │  heading3
│ ₩13,570,000 · 42 stations          │  bodyBold + caption
│ Finalized: Apr 1, 2026              │  caption, textSecondary
│ ✓ Verified                          │  VerifiedBadge (compact)
└──────────────────────────────────────┘
```

- Height: ~90px
- Background: `surface`, border radius: `borderRadius.md`
- `ViewSourceLink` at bottom for L3 navigation

### 3.5 Chart Components

#### RevenueBarChart

Monthly revenue trend. Primary chart component.

```typescript
interface RevenueBarChartProps {
  data: Array<{ month: string; amount: number }>;  // 6-12 data points
  height?: number;                // default: 200
  showTooltip?: boolean;          // default: true (tap bar → tooltip)
  barColor?: string;              // default: primary
}
```

**Visual Spec**:
- Library: `react-native-gifted-charts`
- Bar width: 28px, spacing: 12px
- Bar color: `primary` (light mode), `primary` (dark mode)
- Bar radius: top-left and top-right `borderRadius.sm` (6px)
- Grid lines: 3 horizontal, `borderLight` color, dashed
- X-axis labels: `overline` variant (month abbreviation)
- Y-axis labels: `caption` variant (abbreviated KRW: "₩13.5M")
- Tooltip on tap: `surfaceElevated` bg, `shadow.md`, shows exact amount
- Entrance animation: bars grow from 0 height, `durationChart` (600ms), `easingDecelerate`
- Container: `borderRadius.md`, `spacing.lg` padding

#### RevenueLineChart

Alternative revenue visualization for compact spaces.

```typescript
interface RevenueLineChartProps {
  data: Array<{ month: string; amount: number }>;
  height?: number;                // default: 160
  showGradient?: boolean;         // default: true
}
```

- Line: 2px, `primary` color
- Gradient fill: `primary` at 20% opacity → transparent
- Data points: 6px circles at each data point
- Same x-axis/y-axis conventions as bar chart

### 3.6 Loading Components

All loading states use react-native-reanimated for 60fps animation.

#### SkeletonBox

Base skeleton primitive.

```typescript
interface SkeletonBoxProps {
  width: number | string;         // e.g., 200 or '100%'
  height: number;
  borderRadius?: number;          // default: borderRadius.sm
}
```

**Animation**: Left-to-right shimmer gradient.
- Base: `skeleton` color
- Highlight: `skeletonHighlight` color
- Cycle: `shimmerCycle` (1200ms), `withRepeat(-1)`, `withTiming`
- Uses `react-native-reanimated` shared value for synchronized shimmer across all skeleton components on screen

#### SkeletonText

```typescript
interface SkeletonTextProps {
  lines?: number;                 // default: 1
  widths?: (number | string)[];   // per-line width, default: ['100%', '80%', '60%']
  height?: number;                // per-line height, default: 14
}
```

- Gap between lines: `spacing.sm` (8px)
- Border radius: `borderRadius.sm`

#### SkeletonCard

Full-card skeleton matching RegionCard dimensions.

```typescript
interface SkeletonCardProps {
  variant?: 'region' | 'station' | 'session';  // default: 'region'
}
```

| Variant | Height | Internal skeleton elements |
|:--|:--|:--|
| `region` | 130px | 3 SkeletonText lines + 1 SkeletonBox (badge) |
| `station` | 72px | 2 SkeletonText lines |
| `session` | 110px | 4 SkeletonText lines + 1 SkeletonBox (badge) |

- Same padding, border, border radius as real card

#### SkeletonChart

```typescript
interface SkeletonChartProps {
  height?: number;                // default: 200
}
```

- Single `SkeletonBox` at full width × height
- Border radius: `borderRadius.md`

### 3.7 State Components

#### ErrorState

Full-screen error with optional cached data fallback. Matches Doc 3 §4.2 wireframes.

```typescript
interface ErrorStateProps {
  type: 'rpc' | 'network';       // Error classification
  onRetry: () => void;
  hasCachedData?: boolean;
  cachedTimestamp?: Date;         // "Showing data from 5 minutes ago"
}
```

**Layout (no cache)**:
```
┌──────────────────────────────────────┐
│                                       │
│              ⚠️ (48px)                │  warning icon
│                                       │
│     Unable to load data               │  heading2, text
│                                       │
│     Please try again shortly          │  body, textSecondary
│                                       │
│     ┌──────────────────────────┐     │
│     │        Try Again           │     │  Button: primary bg, white text
│     └──────────────────────────┘     │
└──────────────────────────────────────┘
```

**Layout (with cache)**:
Same + additional line below retry button:
```
     Showing data from 5 minutes ago     │  caption, warning color
```

#### EmptyState

No data placeholder. Matches Doc 3 §4.2 NO_HOLDINGS wireframe.

```typescript
interface EmptyStateProps {
  icon?: string;                  // MaterialIcons name
  title: string;
  description: string;
  ctaLabel?: string;              // Button label
  onCta?: () => void;             // Button handler
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│                                       │
│             📊 (48px)                 │  icon, textSecondary
│                                       │
│     No investments yet                │  heading2, text
│                                       │
│     Explore revenue data from         │  body, textSecondary
│     EV charging infrastructure        │
│     across 17 regions                 │
│                                       │
│     ┌──────────────────────────┐     │
│     │      Explore Regions       │     │  Button: primary bg, white text
│     └──────────────────────────┘     │
└──────────────────────────────────────┘
```

- Vertically centered in available space
- Icon: 48px, `textSecondary` color
- CTA button: width 220px, height 48px, `borderRadius.md`

#### OfflineBanner

Top-of-screen persistent banner for network disconnection.

```typescript
interface OfflineBannerProps {
  visible: boolean;               // NetInfo connectivity state
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ ⚡ Check your internet connection    │  errorBg, caption(white)
└──────────────────────────────────────┘
```

- Background: `errorBg`
- Text: white, `captionBold`
- Icon: `wifi-off` 18px
- Height: 44px
- Fixed at top of screen (below status bar)
- Animate in/out: slide down from top, `durationNormal` (200ms)
- Auto-dismisses when connectivity restored

#### SessionExpiredBanner

```typescript
interface SessionExpiredBannerProps {
  visible: boolean;
  onSignIn: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ 🔑 Session expired. [Sign in again] │  warningBg, caption
└──────────────────────────────────────┘
```

- Background: `warningBg`
- "Sign in again" is tappable link (`primary` color, underline)
- Same dimensions and animation as OfflineBanner

### 3.8 Navigation Components

#### TabBar

3-tab bottom navigation. Replaces current single-tab layout.

```typescript
// Configured in app/(tabs)/_layout.tsx via expo-router <Tabs> component
```

**Specification**:

| Tab | Icon | Label (EN) | Label (KR) | Auth Required |
|:--|:--|:--|:--|:--|
| 1 | `pie-chart` | My Portfolio | 내 투자 | Yes (shows AuthGate) |
| 2 | `explore` | Explore | 탐색 | No |
| 3 | `more-horiz` | More | 더보기 | No |

- Active color: `tabActive` (`primary`)
- Inactive color: `tabInactive`
- Background: `tabBarBg`
- Top border: 1px `tabBarBorder`
- Height: 56px + safe area bottom inset
- Labels: `captionBold` (11px for tab labels)
- Icon size: 24px
- Haptic feedback on iOS (existing `HapticTab` component)

#### ScreenHeader

Stack navigation header for detail screens.

```typescript
interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;            // If undefined, uses router.back()
  rightAction?: {
    icon: string;                 // MaterialIcons name
    onPress: () => void;
  };
}
```

- Height: 56px
- Back button: `arrow-back-ios` 20px, left-aligned, 48px touch target
- Title: `heading2`, centered
- Right action: icon button, 48px touch target
- Background: `background`
- Bottom border: 1px `borderLight`

#### AuthGate

Blocker screen shown when unauthenticated user taps Tab 1. Defined in Doc 3 §2.

```typescript
interface AuthGateProps {
  onSignIn: () => void;           // Navigate to login screen
  onContinueExploring: () => void; // Switch to Tab 2
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│                                       │
│              🔒 (64px)                │  lock-outline, textTertiary
│                                       │
│     Sign in to view your              │  heading1, text
│     investment portfolio              │
│                                       │
│     ┌──────────────────────────┐     │
│     │         Sign In            │     │  primary bg, white text, 52px height
│     └──────────────────────────┘     │
│                                       │
│     ┌──────────────────────────┐     │
│     │    Continue Exploring      │     │  transparent bg, primary text, border
│     └──────────────────────────┘     │
│                                       │
└──────────────────────────────────────┘
```

- Vertically centered
- Sign In button: `primary` bg, white text, `borderRadius.md`, height 52px
- Continue Exploring: transparent bg, `primary` text, 1px `primary` border, `borderRadius.md`, height 52px
- Button width: 280px, centered

### 3.9 Form Components

#### LoginButton

Social/email authentication buttons for login screen.

```typescript
interface LoginButtonProps {
  variant: 'email' | 'google' | 'apple';
  onPress: () => void;
  loading?: boolean;
}
```

| Variant | Background | Text | Icon |
|:--|:--|:--|:--|
| `email` | `primary` | white | `mail-outline` |
| `google` | `surfaceElevated` | `text` | Google logo |
| `apple` | `#000000` (light) / `#FFFFFF` (dark) | inverse | Apple logo |

- Height: 52px
- Width: full (screen - 2 × `spacing.xxl`)
- Border radius: `borderRadius.md` (12px)
- Gap between buttons: `spacing.md` (12px)

#### SortPicker

Region list sort selector.

```typescript
interface SortPickerProps {
  value: 'revenue' | 'stations' | 'name';
  onChange: (value: 'revenue' | 'stations' | 'name') => void;
}
```

- Trigger: Button with current sort label + `sort` icon
- Options rendered as bottom sheet (mobile) or dropdown (web)
- Typography: `captionBold`
- Trigger height: 36px, border: 1px `border`, `borderRadius.sm`

### 3.10 Button Component

Base button used across the app.

```typescript
interface ButtonProps {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'md' | 'sm';     // default: 'md'
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;            // default: false
}
```

| Variant | Background | Text | Border |
|:--|:--|:--|:--|
| `primary` | `primary` | `#FFFFFF` | none |
| `secondary` | transparent | `primary` | 1px `primary` |
| `ghost` | transparent | `primary` | none |

| Size | Height | Font | Padding H |
|:--|:--|:--|:--|
| `lg` | 52px | `bodyBold` | 24px |
| `md` | 44px | `bodyBold` | 20px |
| `sm` | 36px | `captionBold` | 16px |

- Border radius: `borderRadius.md` (12px)
- Press feedback: opacity 0.7
- Loading: replace label with spinner
- Disabled: opacity 0.5, no press feedback

### 3.11 App Initialization Component

Handles State Machine A: INITIAL state (Doc 3 §2).

```typescript
// Implemented in app/_layout.tsx root layout
```

**Behavior**:
1. App launches → check AsyncStorage for stored session token
2. If valid token found → navigate to `(tabs)` (Authed state)
3. If no token or expired → navigate to `/welcome` (Login Screen state)

**Visual**: Splash screen (expo-splash-screen) remains visible during session check. No custom loading UI needed — the check is <100ms (local storage read).

---

## 3.A Data Fetching & Polling Strategy

Bridges Doc 3 §7 (refresh strategy) to implementation. Defines how screens fetch and refresh data.

### 3.A.1 Data Fetching Hook Pattern

Each contract call is managed by an independent hook instance:

```typescript
// hooks/use-contract-query.ts
interface UseContractQueryOptions<T> {
  queryFn: () => Promise<T>;      // Contract call function
  cacheTTL: number;               // Cache TTL in ms
  pollingInterval?: number;       // Optional polling (0 = disabled)
  enabled?: boolean;              // Conditional fetching (e.g., auth required)
}

interface ContractQueryResult<T> {
  data: T | null;                 // Resolved data or null
  state: 'idle' | 'loading' | 'success' | 'stale' | 'error';
  timestamp: Date | null;         // Last successful fetch time
  error: Error | null;
  refetch: () => void;            // Manual refresh trigger
}
```

### 3.A.2 Polling Configuration

From Doc 3 §7.1 — only 2 functions poll automatically:

| Contract Function | Polling Interval | Screens |
|:--|:--|:--|
| `RevenueTracker.getRegionRevenue()` | 60 seconds | Portfolio Overview, Region Detail |
| `ChargeTransaction.totalSessions()` | 60 seconds | Station Detail |
| All others | No polling (manual refresh only) | — |

### 3.A.3 Refresh Triggers

| Trigger | Behavior |
|:--|:--|
| **Screen mount** | All queries for that screen fire immediately |
| **Pull-to-refresh** | All queries on current screen re-fetch (ignore cache) |
| **Polling timer** | Only configured queries re-fetch in background |
| **Cache TTL expired** | Query transitions to `stale` state, background re-fetch starts |
| **App foreground** | If last fetch > cache TTL, re-fetch |

### 3.A.4 Cache Persistence

- **In-memory cache**: React state (cleared on app kill)
- **No disk persistence for hackathon** (enhancement: AsyncStorage cache for offline)
- Cache keyed by: `contractAddress:functionName:params`

### 3.A.5 Parallel Loading Coordination

Each screen composes multiple independent hooks. No orchestration needed — React renders progressively:

```typescript
// Example: Portfolio Overview
function PortfolioOverview() {
  const regions = useContractQuery({ queryFn: getAllRegionIds, cacheTTL: 3600000 });
  const balances = useContractQuery({ queryFn: getBalances, cacheTTL: 300000, enabled: !!regions.data });
  const revenues = useContractQuery({ queryFn: getRevenues, cacheTTL: 30000, pollingInterval: 60000, enabled: !!regions.data });

  // Each renders independently: data or skeleton
  return (
    <ScreenContainer>
      {regions.state === 'loading' ? <SkeletonCard /> : <RegionCards regions={regions.data} />}
      {/* Each RegionCard internally shows skeleton for pending sub-queries */}
    </ScreenContainer>
  );
}
```

---

## 4. Screen Specifications

Each screen defines: component composition, data flow, and all states (loading/success/error/empty).

### 4.1 Portfolio Overview (`/portfolio`)

**Auth**: Required (shows AuthGate if unauthenticated)

**Component Composition (Success State)**:
```
ScreenContainer (scrollable, pull-to-refresh)
├── heading1: "My Portfolio"
├── Spacer(md)
├── Summary Section
│   ├── body(textSecondary): "Total units held"
│   ├── display: "700 units"
│   ├── Spacer(sm)
│   ├── body(textSecondary): "This month's revenue"
│   ├── CurrencyDisplay(amount, size='lg')
│   ├── Spacer(sm)
│   └── VerifiedBadge(state, timestamp)
├── Spacer(xl)
├── SectionHeader(title="My Regions")
├── RegionCard(variant='portfolio') × N
│   └── gap: spacing.md between cards
└── Spacer(xxxl)  // bottom clearance
```

**Contract Calls** (parallel, independent State B per call):

| Call | Maps To | Cache TTL |
|:--|:--|:--|
| `RegionSTOFactory.getAllRegionIds()` | Region list | 1 hour |
| `RegionSTO.balanceOf(addr)` per region | Units held per card | 5 min |
| `RegionSTO.totalSupply()` per region | Total units, share % | 30 min |
| `RegionSTO.getTrancheCount()` per region | Tranche count per card | 30 min |
| `RevenueTracker.getRegionRevenue(regionId)` per region | Revenue per card | 30 sec |
| `RevenueTracker.getMonthlyHistory(stationId)` per station per region | MoM change (frontend calc) | 5 min |

**States**:

| State | Display |
|:--|:--|
| Loading | heading1 + 3 × SkeletonCard |
| Partial load | Some data rendered (e.g., units shown), remaining slots show SkeletonText inline. See §4.1.1 |
| Success | Full composition above |
| Error (no cache) | ErrorState(type='rpc', onRetry) |
| Error (has cache) | Cached cards + OfflineBanner |
| Empty (no holdings) | EmptyState("No investments yet", cta="Explore Regions" → Tab 2) |
| Session expired | Current data maintained + SessionExpiredBanner overlays at top (data NOT cleared) |

#### 4.1.1 Partial Load Pattern (Parallel Loading)

When multiple contract calls resolve at different times, the screen renders **progressively**:

```
Phase 1 — balanceOf() resolves first:
┌──────────────────────────────────────┐
│  My Portfolio                         │
│                                       │
│  Total: 700 units                     │  ← Resolved
│  This month: ░░░░░░░░░               │  ← SkeletonText (revenue pending)
│                                       │
│  ┌──────────────────────────────────┐ │
│  │ Seoul Metropolitan       500 u   │ │  ← balanceOf resolved
│  │ Share: ░░░░░░                    │ │  ← totalSupply pending
│  │ ░░░░░░░░░░░░░░░                 │ │  ← revenue pending
│  │ ░░░░░░░░░░░░                    │ │  ← tranche pending
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘

Phase 2 — getRegionRevenue() resolves:
┌──────────────────────────────────────┐
│  My Portfolio                         │
│                                       │
│  Total: 700 units                     │
│  This month: ₩2,380,000             │  ← Now resolved
│  ✓ Hardware Verified · Just updated   │
│  ...                                  │
└──────────────────────────────────────┘
```

**Rule**: Each StatRow / CurrencyDisplay / PercentageChange can independently show SkeletonText or resolved data. The VerifiedBadge appears only after at least one data source resolves.

### 4.2 Regional Investment Detail (`/portfolio/[regionId]`)

**Auth**: Required

**Component Composition (Success State)**:
```
ScreenContainer (scrollable, pull-to-refresh)
├── ScreenHeader(title=regionName, onBack)
├── Hero Section
│   ├── heading1: regionName
│   ├── StatRow("Units held", "500 units")
│   ├── StatRow("My share", "1.0%")
│   ├── StatRow("Total issued", "50,000 units")
│   ├── Divider
│   ├── body(textSecondary): "This month's revenue"
│   ├── CurrencyDisplay(revenue, size='lg')
│   ├── PercentageChange(momChange)
│   └── VerifiedBadge
├── Spacer(xl)
├── SectionHeader("Monthly Revenue", actionLabel="Full history →", onAction)
├── RevenueBarChart(data=last6months, height=200)
├── Spacer(xl)
├── SectionHeader("Infrastructure")
├── StatRow("Stations", "42")
├── StatRow("Chargers", "156")
├── Spacer(xl)
├── SectionHeader("Settlement Reports", actionLabel="View all →", onAction)
├── AttestationCard (latest) × 1
├── Spacer(xl)
├── SectionHeader("Issuance Rounds", actionLabel="View detail →", onAction)
├── TrancheCard (latest) × 1
└── Spacer(xxxl)
```

### 4.3 Revenue History (`/portfolio/[regionId]/revenue`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Revenue History")
├── RevenueBarChart(data=last12months, height=240)
├── Spacer(xl)
├── SectionHeader("Monthly Breakdown")
├── StatRow("March 2026", CurrencyDisplay + PercentageChange) × 12
└── Spacer(xxxl)
```

### 4.4 Issuance Round Detail (`/portfolio/[regionId]/tranches`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Issuance Rounds")
├── StatRow("Total rounds", trancheCount)
├── StatRow("Total issued", totalSupply + " units")
├── Spacer(xl)
├── TrancheCard × N (reverse chronological)
└── Spacer(xxxl)
```

### 4.5 Settlement Report (`/portfolio/[regionId]/attestation`)

**L3 verification screen** — technical terms allowed here.

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Settlement Report")
├── overline: "ORIGINAL DATA"
├── Spacer(md)
├── StatRow("Region", "Seoul Metropolitan (KR-11)")
├── StatRow("Period", "2026.03.01 ~ 2026.03.31")
├── StatRow("Distributable revenue", CurrencyDisplay)
├── StatRow("Stations included", "42")
├── StatRow("Finalized", "Apr 1, 2026 09:00:00")
├── Spacer(xl)
├── Divider
├── heading3: "Data Verification Code"
├── mono(textSecondary): "0x1a2b3c4d...ef56" (Merkle root)
├── caption(textTertiary): "This code proves all 3,420 charging records are included"
├── Spacer(xl)
├── ViewSourceLink("View on Block Explorer →", url)
└── Spacer(xxxl)
```

### 4.6 17-Region List (`/explore`)

**Auth**: Not required (public data)

**Component Composition (Success State)**:
```
ScreenContainer (scrollable, pull-to-refresh)
├── Row: heading1("Explore") + SortPicker
├── body(textSecondary): "EV Charging Infrastructure across 17 Korean Regions"
├── Spacer(xl)
├── RegionCard(variant='explore') × 17
│   └── gap: spacing.md between cards
└── Spacer(xxxl)
```

**States**:

| State | Display |
|:--|:--|
| Loading | heading1 + subtitle + 3 × SkeletonCard |
| Success | Full 17 cards |
| Error (no cache) | ErrorState(type='rpc', onRetry) |
| Error (has cache) | Cached cards + OfflineBanner |

### 4.7 Region Detail (`/explore/[regionId]`)

**Component Composition**:
```
ScreenContainer (scrollable, pull-to-refresh)
├── ScreenHeader(title=regionName, onBack)
├── Hero Metrics Row
│   ├── StatRow("Stations", "42")
│   ├── StatRow("Chargers", "156")
│   └── VerifiedBadge
├── Spacer(md)
├── body(textSecondary): "This month's revenue"
├── CurrencyDisplay(revenue, size='lg')
├── PercentageChange(momChange)
├── StatRow("Cumulative", CurrencyDisplay(cumulative, size='sm'))
├── StatRow("Round", trancheCount + " · " + totalUnits + " total units")
├── Spacer(xl)
├── SectionHeader("Monthly Revenue")
├── RevenueBarChart(data=last6months)
├── Spacer(xl)
├── SectionHeader("Stations", actionLabel="View all →", onAction)
├── StationCard × 5 (top 5 by revenue)
├── Spacer(xl)
├── SectionHeader("Settlement History", actionLabel="View all →", onAction)
├── AttestationCard × 3 (latest 3)
└── Spacer(xxxl)
```

### 4.8 Station List (`/explore/[regionId]/stations`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Stations")
├── caption(textSecondary): "42 stations in Seoul Metropolitan"
├── Spacer(lg)
├── SectionHeader("Active")
├── StationCard × N (active=true)
├── Spacer(xl)
├── SectionHeader("Inactive")
├── StationCard × N (active=false, opacity 0.6)
└── Spacer(xxxl)
```

### 4.9 Station Detail (`/explore/[regionId]/stations/[stationId]`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title=stationId)
├── heading2: stationId
├── caption(textSecondary): location
├── StatusBadge(active)
├── Spacer(xl)
├── SectionHeader("Chargers")
├── Row per charger: [icon] chargerId · type (7kW/11kW/22kW) · status
├── Spacer(xl)
├── SectionHeader("Revenue")
├── StatRow("Cumulative", CurrencyDisplay)
├── StatRow("Sessions", totalSessions)
├── Spacer(xl)
├── SectionHeader("Charging Records", actionLabel="View all →", onAction)
├── SessionCard × 5 (latest)
└── Spacer(xxxl)
```

### 4.10 Charging Session List (`/explore/[regionId]/stations/[stationId]/sessions`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Charging Records")
├── caption(textSecondary): "ELEC-GN-001 · 342 sessions"
├── Spacer(lg)
├── SessionCard × N (reverse chronological)
│   └── Each card: "View raw signature →" link
├── Spacer(xxxl)
```

**L3 Inline Expansion**: When user taps "View raw signature →" on a SessionCard:
- Card expands to show `VerificationResult` component below session data
- Smooth height animation with `durationSlow` (300ms)
- Alternatively: navigate to dedicated verification screen

### 4.11 Regional Revenue Chart (`/explore/[regionId]/revenue`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Revenue History")
├── RevenueBarChart(data=last12months, height=240)
├── Spacer(xl)
├── SectionHeader("Monthly Breakdown")
├── Row per month: month label · CurrencyDisplay · PercentageChange
│   └── × 12 months
└── Spacer(xxxl)
```

### 4.12 Settlement History (`/explore/[regionId]/attestations`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Settlement History")
├── caption(textSecondary): "Seoul Metropolitan · 6 settlements"
├── Spacer(lg)
├── AttestationCard × N (reverse chronological)
│   └── onPress → navigate to /portfolio/[regionId]/attestation (L3)
└── Spacer(xxxl)
```

### 4.13 More Main (`/more`)

**Component Composition**:
```
ScreenContainer (scrollable=false)
├── Row: heading1("More") + LanguageToggle(EN/KR)
├── Spacer(xl)
├── MenuList
│   ├── MenuItem(icon="menu-book", title="Investment Guide", subtitle="What is EV charging infrastructure STO?")
│   ├── Divider
│   ├── MenuItem(icon="verified", title="Data Verification Center", subtitle="Verify original data")
│   ├── Divider
│   ├── MenuItem(icon="info-outline", title="About EnergyFi", subtitle="Company info, audits")
│   ├── Divider
│   └── MenuItem(icon="settings", title="Settings", subtitle="Language, logout")
└── Spacer(xxxl)
```

**LanguageToggle**: Segmented control with `EN` / `KR` options.
- Width: 100px, height: 32px
- Active segment: `primary` bg, white text
- Inactive segment: `surface` bg, `textSecondary`
- Border radius: `borderRadius.sm`

**MenuItem**:
```typescript
interface MenuItemProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}
```
- Height: 72px
- Icon: 22px, `textSecondary` → left
- Title: `body` + subtitle: `caption(textSecondary)` → center
- Chevron right → right
- Background: transparent, press: `surface`

### 4.14 Investment Guide (`/more/guide`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="Investment Guide")
├── heading2: "What is EV charging infrastructure STO?"
├── body: Explanation paragraph (no blockchain terms)
├── Spacer(xl)
├── heading2: "How It Works"
├── Step 1-3 cards (image placeholder + description)
├── Spacer(xl)
├── heading2: "How to Read Revenue Data"
├── body: Explanation of charts, verification
├── Spacer(xl)
├── heading2: "What is Hardware Verification?"
├── body: Simplified Bookend explanation
└── Spacer(xxxl)
```

### 4.15 Settings (`/more/settings`)

**Component Composition**:
```
ScreenContainer (scrollable=false)
├── ScreenHeader(title="Settings")
├── SectionHeader("Language")
├── RadioRow("English", selected=isEN)
├── RadioRow("한국어", selected=isKR)
├── Spacer(xl)
├── SectionHeader("Account")
├── MenuItem("Sign Out", destructive=true)
└── Spacer(xxxl)
```

### 4.16 About EnergyFi (`/more/about`)

**Component Composition**:
```
ScreenContainer (scrollable)
├── ScreenHeader(title="About EnergyFi")
├── App icon (64px) + "EnergyFi" heading2 + version caption
├── Spacer(xl)
├── body: Company description
├── Spacer(xl)
├── SectionHeader("Certifications")
├── CertBadge("FSS Security Audit Complete")
├── CertBadge("Avalanche Network")
├── Spacer(xl)
├── SectionHeader("Links")
├── MenuItem("Website", onPress=openExternal)
├── MenuItem("Block Explorer", onPress=openExternal)
└── Spacer(xxxl)
```

### 4.17 Onboarding: Welcome (`/welcome`)

**Component Composition**:
```
View (full screen, no scroll)
├── Spacer(xxxl)
├── [Map illustration placeholder — 17 regions highlighted]
├── Spacer(xl)
├── heading1: "Invest in EV Charging\nInfrastructure"
├── Spacer(md)
├── body(textSecondary): "Track real-time revenue from\n17 Korean regions with hardware-verified data"
├── Flex spacer (push button to bottom)
├── Button(variant='primary', size='lg', label="Get Started", fullWidth)
├── Spacer(lg)
├── Button(variant='ghost', label="I already have an account")
├── Spacer(xxxl)  // safe area
```

### 4.18 Onboarding: Login (`/login`)

**Component Composition**:
```
View (full screen, keyboard-avoiding)
├── ScreenHeader(title="Sign In", onBack)
├── Spacer(xxl)
├── heading2: "Sign in to EnergyFi"
├── Spacer(xl)
├── LoginButton(variant='google')
├── LoginButton(variant='apple')
├── Spacer(lg)
├── Divider with centered "or" text
├── Spacer(lg)
├── TextInput(placeholder="Email address")
├── Spacer(md)
├── Button(variant='primary', label="Continue with Email")
├── Spacer(lg)
├── caption(textTertiary): "By signing in, you agree to our Terms of Service"
└── Spacer(xxxl)
```

---

## 5. Animation & Interaction Patterns

### 5.1 Skeleton Shimmer

```typescript
// Shared shimmer animation value — all skeletons sync to this
const shimmerProgress = useSharedValue(0);

useEffect(() => {
  shimmerProgress.value = withRepeat(
    withTiming(1, { duration: 1200, easing: Easing.linear }),
    -1, // infinite
    false // no reverse
  );
}, []);
```

- Direction: left → right gradient sweep
- Base: `skeleton` color, highlight: `skeletonHighlight` color
- All skeleton components on same screen share the same `shimmerProgress` value

### 5.2 Screen Transitions

- **Stack push/pop**: expo-router default (slide from right on iOS, fade on Android)
- **Tab switch**: Crossfade (default bottom tabs behavior)
- **Modal**: Slide up from bottom (for future bottom sheets)

### 5.3 Content Transitions

| Transition | Animation | Duration |
|:--|:--|:--|
| Skeleton → Content | Fade in | `durationNormal` (200ms) |
| Error → Content (retry success) | Fade crossfade | `durationSlow` (300ms) |
| Badge state change | Text/icon crossfade | `durationFast` (150ms) |
| Card press | Opacity to 0.7, then back | `durationFast` (150ms) |
| Chart bar entrance | Grow from height 0 | `durationChart` (600ms), `easingDecelerate` |
| Banner appear/dismiss | Slide from top | `durationNormal` (200ms) |
| L3 signature expand | Height grow | `durationSlow` (300ms) |

### 5.4 Pull-to-Refresh

- Uses native `RefreshControl` component
- Color: `primary`
- Triggers all State B instances on current screen to transition LOADING → re-fetch

### 5.5 Reduced Motion

When `AccessibilityInfo.isReduceMotionEnabled`:
- Shimmer: disabled (static skeleton color)
- Chart entrance: instant (no grow animation)
- Transitions: instant (duration = 0)
- All other animations: crossfade with 0ms

---

## 6. Responsive Layout

### 6.1 Breakpoints

| Name | Width | Target |
|:--|:--|:--|
| `mobile` | < 768px | Phone (primary) |
| `tablet` | 768–1024px | Tablet |
| `desktop` | > 1024px | Desktop browser (hackathon demo) |

### 6.2 Layout Rules

| Element | Mobile | Tablet | Desktop |
|:--|:--|:--|:--|
| Screen padding H | 16px | 24px | auto (centered) |
| Content max-width | 100% | 600px (centered) | 960px (centered) |
| Card list | 1 column | 1 column | 2 columns (460px each, 16px gap) |
| Charts | Full width | Full width | Full width (within max-width) |
| Tab bar | Bottom fixed | Bottom fixed | Bottom fixed (mobile web feel) |

### 6.3 Web-Specific

- `expo web.output: "static"` → static HTML build
- Tab navigation maintained on web (intentional mobile-web feel for hackathon)
- Hover effects on cards: subtle `surface` → `surfaceElevated` background change
- Cursor: pointer on interactive elements

---

## 7. Accessibility

### 7.1 Touch Targets

- Minimum: 48 × 48px (WCAG 2.5.8)
- Tab buttons: 48px height (icons 24px + label + padding)
- Card taps: entire card is touch target
- Links: 44px minimum height with padding

### 7.2 Color Contrast

All text/background combinations meet WCAG AA (4.5:1):

| Pair | Light Ratio | Dark Ratio | Pass |
|:--|:--|:--|:--|
| `text` on `background` | 15.4:1 | 13.5:1 | AA |
| `textSecondary` on `background` | 5.3:1 | 4.9:1 | AA |
| `textTertiary` on `background` | 3.2:1 | 3.6:1 | AA (large text only) |
| `verified` on `verifiedBg` | 4.6:1 | 5.1:1 | AA |
| white on `primary` | 5.8:1 | 3.2:1 | AA / AA (large) |

### 7.3 Screen Reader

- All icons: `accessibilityLabel` provided
- VerifiedBadge: announces "Hardware Verified, updated 30 seconds ago"
- Cards: announce full content (region name, revenue, status)
- Charts: `accessibilityLabel` with summary text ("Revenue trend: ₩13.5M in March, up 12%")

### 7.4 Gain/Loss Accessibility

- **Never rely on color alone** — arrow (↑/↓) always accompanies gain/loss color
- Both EN and KR locales use directional arrows
- Screen reader: announces "up 12 percent" or "down 5 percent"

---

## 8. i18n Implementation

### 8.1 Technology Stack

```
expo-localization     → Detect device locale
i18next              → Translation engine
react-i18next        → React hooks (useTranslation)
AsyncStorage         → Persist language preference
```

Installation:
```bash
npx expo install expo-localization @react-native-async-storage/async-storage
npm install i18next react-i18next
```

### 8.2 Translation File Structure

```
frontend/
├── locales/
│   ├── en.json       # English (default, hackathon primary)
│   └── ko.json       # Korean (target market)
```

**Key naming convention**: `{tab}.{screen}.{element}`

```json
// en.json (excerpt)
{
  "common": {
    "tryAgain": "Try Again",
    "viewAll": "View all",
    "viewSourceData": "View source data",
    "updated": "Updated {{time}} ago",
    "lastChecked": "Last checked: {{time}} ago",
    "updating": "Updating...",
    "hardwareVerified": "Hardware Verified",
    "units": "units",
    "round": "Round {{count}}",
    "totalUnits": "{{count}} total units",
    "stations": "{{count}} stations",
    "chargers": "{{count}} chargers",
    "sessions": "{{count}} sessions"
  },
  "portfolio": {
    "title": "My Portfolio",
    "totalUnitsHeld": "Total units held",
    "thisMonthRevenue": "This month's revenue",
    "myRegions": "My Regions",
    "share": "Share",
    "unitsHeld": "Units held",
    "noInvestments": "No investments yet",
    "noInvestmentsDesc": "Explore revenue data from EV charging infrastructure across 17 regions",
    "exploreRegions": "Explore Regions"
  },
  "explore": {
    "title": "Explore",
    "subtitle": "EV Charging Infrastructure across 17 Korean Regions",
    "thisMonth": "This month",
    "cumulative": "Cumulative",
    "monthlyRevenue": "Monthly Revenue",
    "stations": "Stations",
    "chargingRecords": "Charging Records",
    "settlementHistory": "Settlement History",
    "issuanceRounds": "Issuance Rounds"
  },
  "more": {
    "title": "More",
    "investmentGuide": "Investment Guide",
    "investmentGuideDesc": "What is EV charging infrastructure STO?",
    "verificationCenter": "Data Verification Center",
    "verificationCenterDesc": "Verify original data",
    "about": "About EnergyFi",
    "aboutDesc": "Company info, audits",
    "settings": "Settings",
    "settingsDesc": "Language, logout"
  },
  "auth": {
    "signIn": "Sign In",
    "signInToView": "Sign in to view your investment portfolio",
    "continueExploring": "Continue Exploring",
    "signingIn": "Signing in...",
    "signInFailed": "Sign-in failed. Please try again.",
    "sessionExpired": "Session expired.",
    "signInAgain": "Sign in again",
    "signOut": "Sign Out"
  },
  "error": {
    "unableToLoad": "Unable to load data",
    "tryAgainShortly": "Please try again shortly",
    "checkInternet": "Check your internet connection",
    "showingCachedData": "Showing data from {{time}} ago"
  },
  "verification": {
    "hardwareSignature": "Hardware Signature Verification",
    "chipSignedData": "The charger's security chip directly signed this data.",
    "status": "Status",
    "verified": "Verified",
    "invalid": "Invalid",
    "algorithm": "Algorithm",
    "chipId": "Chip ID",
    "enrolled": "Enrolled",
    "signature": "Signature",
    "viewOnExplorer": "View on Block Explorer"
  }
}
```

```json
// ko.json (excerpt)
{
  "common": {
    "tryAgain": "다시 시도",
    "viewAll": "전체 보기",
    "viewSourceData": "원본 데이터 보기",
    "updated": "{{time}} 전 업데이트",
    "lastChecked": "마지막 확인: {{time}} 전",
    "updating": "업데이트 중...",
    "hardwareVerified": "하드웨어 인증",
    "units": "좌",
    "round": "{{count}}차",
    "totalUnits": "총 {{count}}좌",
    "stations": "{{count}}개 충전소",
    "chargers": "{{count}}개 충전기",
    "sessions": "{{count}}건"
  },
  "portfolio": {
    "title": "내 투자",
    "totalUnitsHeld": "총 보유 좌수",
    "thisMonthRevenue": "이번 달 수익",
    "myRegions": "내 투자 지역",
    "share": "지분율",
    "unitsHeld": "보유 좌수",
    "noInvestments": "아직 투자 상품이 없습니다",
    "noInvestmentsDesc": "17개 지역의 EV 충전 인프라 수익 데이터를 둘러보세요",
    "exploreRegions": "지역 탐색하기"
  },
  "explore": {
    "title": "탐색",
    "subtitle": "전국 17개 지역 EV 충전 인프라",
    "thisMonth": "이번 달",
    "cumulative": "누적",
    "monthlyRevenue": "월별 수익",
    "stations": "충전소",
    "chargingRecords": "충전 기록",
    "settlementHistory": "정산 이력",
    "issuanceRounds": "발행 차수"
  },
  "more": {
    "title": "더보기",
    "investmentGuide": "투자 가이드",
    "investmentGuideDesc": "EV 충전 인프라 투자란?",
    "verificationCenter": "데이터 검증 센터",
    "verificationCenterDesc": "원본 데이터 검증",
    "about": "EnergyFi 소개",
    "aboutDesc": "회사 정보, 감사 이력",
    "settings": "설정",
    "settingsDesc": "언어, 로그아웃"
  },
  "auth": {
    "signIn": "로그인",
    "signInToView": "투자 포트폴리오를 보려면 로그인하세요",
    "continueExploring": "탐색 계속하기",
    "signingIn": "로그인 중...",
    "signInFailed": "로그인에 실패했습니다. 다시 시도해주세요.",
    "sessionExpired": "세션이 만료되었습니다.",
    "signInAgain": "다시 로그인",
    "signOut": "로그아웃"
  },
  "error": {
    "unableToLoad": "데이터를 불러올 수 없습니다",
    "tryAgainShortly": "잠시 후 다시 시도해주세요",
    "checkInternet": "인터넷 연결을 확인해주세요",
    "showingCachedData": "{{time}} 전 데이터를 표시 중입니다"
  },
  "verification": {
    "hardwareSignature": "하드웨어 서명 검증",
    "chipSignedData": "충전기의 보안 칩이 이 데이터에 직접 서명했습니다.",
    "status": "상태",
    "verified": "검증 완료",
    "invalid": "검증 실패",
    "algorithm": "알고리즘",
    "chipId": "칩 ID",
    "enrolled": "등록일",
    "signature": "서명",
    "viewOnExplorer": "블록 탐색기에서 보기"
  }
}
```

### 8.3 Locale-Dependent Formatting

```typescript
// hooks/use-locale-format.ts
export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;  // 'en' or 'ko'

  return {
    formatCurrency: (amount: number) => {
      if (locale === 'ko') return `${amount.toLocaleString('ko-KR')}원`;
      return `₩${amount.toLocaleString('ko-KR')}`;
    },
    formatDate: (date: Date) => {
      if (locale === 'ko') return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    },
    formatUnits: (count: number) => {
      if (locale === 'ko') return `${count.toLocaleString()}좌`;
      return `${count.toLocaleString()} units`;
    },
    gainColor: locale === 'ko' ? 'gainKR' : 'gainEN',
    lossColor: locale === 'ko' ? 'lossKR' : 'lossEN',
  };
}
```

### 8.4 Language Toggle

- Location: Tab 3 (More) header area
- Persistence: `AsyncStorage.setItem('language', 'en' | 'ko')`
- Initial: detect from `expo-localization` (`Localization.getLocales()[0].languageCode`)
- Fallback: `'en'`
- L3 technical terms (SE signature hex, Merkle root, algorithm names): always English regardless of locale

---

## 9. Hackathon MVP vs Enhancement

### 9.1 MVP Scope (Hackathon Web Prototype)

**Included**:

| Category | Items |
|:--|:--|
| **Design tokens** | Full color palette, typography, spacing, shadows, icons |
| **Core components** | RegionCard (both), StationCard, SessionCard, VerifiedBadge, VerificationResult, CurrencyDisplay, PercentageChange, StatRow, DataTimestamp, ViewSourceLink |
| **Loading components** | SkeletonBox, SkeletonText, SkeletonCard, SkeletonChart |
| **State components** | ErrorState, EmptyState, OfflineBanner, SessionExpiredBanner |
| **Navigation** | 3-tab TabBar, ScreenHeader, AuthGate |
| **Charts** | RevenueBarChart |
| **Screens** | Portfolio Overview, Regional Investment Detail, 17-Region List, Region Detail, Station List, Station Detail, Charging Sessions + L3, More Main, Settings, About, Welcome, Login |
| **i18n** | Full EN + KR translations, locale formatting |
| **Responsive** | Mobile + desktop web layout |

**Excluded** (post-hackathon enhancement):

| Category | Items |
|:--|:--|
| **Components** | TrancheCard (full), RevenueLineChart, Bookend visualization |
| **Screens** | Investment Guide (full), Verification Center, Bookend visualization, Revenue History (full 12-month) |
| **Features** | Sort/filter on region list, region comparison, push notifications |
| **Onboarding** | How It Works carousel, Portfolio Connect, Quick Tour |

### 9.2 MVP Implementation Priority

```
Phase A: Foundation (tokens + layout + navigation)
  ├── Design token system (theme.ts extension)
  ├── 3-tab layout + routing structure
  ├── ScreenContainer, ScreenHeader, Button
  └── i18n setup (i18next + locales)

Phase B: Core Components
  ├── CurrencyDisplay, PercentageChange, StatRow
  ├── VerifiedBadge, ViewSourceLink
  ├── SkeletonBox, SkeletonText, SkeletonCard
  └── ErrorState, EmptyState

Phase C: Card Components
  ├── RegionCard (portfolio + explore variants)
  ├── StationCard, SessionCard
  ├── AttestationCard
  └── RevenueBarChart

Phase D: Screens (Tab 2 first — public, no auth needed)
  ├── Explore: 17-Region List
  ├── Explore: Region Detail
  ├── Explore: Station List + Detail
  ├── Explore: Charging Sessions + L3 Verification
  └── Explore: Settlement History

Phase E: Screens (Tab 1 — auth required)
  ├── AuthGate
  ├── Portfolio Overview
  ├── Regional Investment Detail
  └── Revenue History (simplified)

Phase F: Screens (Tab 3 + Onboarding)
  ├── More Main + Settings + About
  ├── Welcome screen
  └── Login screen
```

---

## 10. Cross-Document Traceability

### 10.1 Doc 4 (Persona) → Doc 5

| Persona Insight | Doc 5 Decision |
|:--|:--|
| REIT mental model | Data-dense cards (§3.4), financial typography (§2.2 `display` variant) |
| "Is this real?" anxiety | VerifiedBadge on every screen (§3.3), ViewSourceLink (§3.3) |
| Zero blockchain knowledge | Terminology Shield reflected in all i18n keys (§8.2) — no technical terms in L1/L2 |
| Toss/Kiwoom familiarity | System font, rounded cards, generous spacing (§2.3-2.4) |
| 30-second morning check | Portfolio Overview hero numbers (§4.1) above-the-fold |
| Locale-dependent colors | `gainEN/lossEN/gainKR/lossKR` tokens (§2.1), `useLocaleFormat` hook (§8.3) |

### 10.2 Doc 1 (Journey Map) → Doc 5

| Journey Moment | Doc 5 Response |
|:--|:--|
| Phase 2 trust valley | VerifiedBadge (§3.3) + L3 VerificationResult (§3.3) fills trust gap |
| Phase 4 "Is my investment reflected?" | Portfolio Overview instant display (§4.1) with skeleton → content transition |
| Phase 5 monthly check | RevenueBarChart (§3.5) + PercentageChange (§3.2) answer "Is revenue growing?" |

### 10.3 Doc 2 (IA) → Doc 5

Every screen in Doc 2 §3 navigation tree has a corresponding §4.x specification:

| Doc 2 Route | Doc 5 Section | Status |
|:--|:--|:--|
| `/portfolio` | §4.1 | MVP |
| `/portfolio/[regionId]` | §4.2 | MVP |
| `/portfolio/[regionId]/revenue` | §4.3 | MVP |
| `/portfolio/[regionId]/tranches` | §4.4 | MVP |
| `/portfolio/[regionId]/attestation` | §4.5 | MVP |
| `/explore` | §4.6 | MVP |
| `/explore/[regionId]` | §4.7 | MVP |
| `/explore/[regionId]/stations` | §4.8 | MVP |
| `/explore/[regionId]/stations/[stationId]` | §4.9 | MVP |
| `/explore/[regionId]/stations/[stationId]/sessions` | §4.10 | MVP |
| `/explore/[regionId]/revenue` | §4.11 | MVP |
| `/explore/[regionId]/attestations` | §4.12 | MVP |
| `/more` | §4.13 | MVP |
| `/more/guide` | §4.14 | MVP |
| `/more/settings` | §4.15 | MVP |
| `/more/about` | §4.16 | MVP |
| `/more/verify` | — | Post-hackathon (§9.1) |
| `/more/verify/session/[tokenId]` | — | Post-hackathon (§9.1) |
| `/more/verify/bookend` | — | Post-hackathon (§9.1) |
| `/welcome` | §4.17 | MVP |
| `/login` | §4.18 | MVP |
| `/how-it-works` | — | Post-hackathon (§9.1) |
| `/portfolio-connect` | — | Post-hackathon (§9.1) |

### 10.4 Doc 3 (State Machine) → Doc 5

| State Machine State | Doc 5 Component |
|:--|:--|
| A: INITIAL | Splash screen (expo-splash-screen) during session check (§3.11) |
| A: Login Screen | AuthGate (§3.8), Login screen (§4.18) |
| A: Authenticating | LoginButton loading state (§3.9) |
| A: Authed | All data screens render normally (§4.1–§4.16) |
| A: Auth Error | Login screen error message (§4.18 inline) |
| A: Session Expired | SessionExpiredBanner overlays at top; current data maintained (§3.7) |
| B: IDLE | — (screen not yet mounted) |
| B: LOADING | SkeletonCard, SkeletonText, SkeletonChart (§3.6) |
| B: Partial load | Mixed skeleton + resolved data per §4.1.1 parallel loading pattern |
| B: SUCCESS | All data components render (§3.2, §3.4, §3.5) |
| B: STALE | VerifiedBadge(state='updating') (§3.3), DataTimestamp(variant='stale') (§3.2) |
| B: ERROR (no cache) | ErrorState (§3.7) |
| B: ERROR (has cache) | Cached data + OfflineBanner (§3.7) + DataTimestamp(variant='error') |
| RPC_TIMEOUT / RPC_ERROR | ErrorState(type='rpc') (§3.7) |
| NETWORK_OFFLINE | OfflineBanner (§3.7) |
| AUTH_EXPIRED | SessionExpiredBanner (§3.7) — overlays, does NOT clear data |
| NO_HOLDINGS | EmptyState (§3.7) |

---

*End of Document*
