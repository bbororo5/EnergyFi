# Home On-Chain Spec

## Purpose

`Home` is the investor desk.
It should answer:

- what the network is doing now
- what revenue proof exists right now
- which regions are worth drilling into next

## Data Model Split

Home now uses two layers:

- `factual on-chain layer`
  - sourced directly from EnergyFi contract interfaces
- `ownership overlay layer`
  - optional
  - sourced from manual input or a future securities-firm API

The hero preserves its original role, but the data source is explicit.

## Contract-Backed Fields

### Hero

- monthly network revenue trend
  - aggregated from region attestation history
- current displayed revenue
  - defaults to network revenue
  - can switch to estimated user share when ownership overlay exists
- pending network revenue
  - from `RevenueTracker.getRegionRevenue(regionId)` summed across the catalog

### Region Carousel

- region identity
- station count
- pending revenue
- latest finalized revenue
- active charger coverage
- snapshot period / peak window
- issuance state

### Impact

- delivered energy
  - derived from `ChargeTransaction.getSession(tokenId).energyKwh`
- estimated CO2 avoided
  - frontend-derived metric with an explicit methodology note

### Live Feed

- latest charging sessions only
- no mock traffic fallback
- station label, revenue, kWh, relative time, charger type

## Ownership Overlay Hypothesis

The Home hero preserves space for user-specific views.

Current supported overlay inputs:

- `EXPO_PUBLIC_SECURITIES_HOLDINGS_URL`
  - external API hypothesis
- `EXPO_PUBLIC_HOME_SHARE_PERCENT`
  - manual share input hypothesis
- `EXPO_PUBLIC_HOME_PORTFOLIO_VALUE_KRW`
  - manual estimated portfolio value

If no ownership overlay exists, the hero remains usable in pure on-chain mode.

## Runtime Files

- screen: `mobile/app/(tabs)/index.tsx`
- main hook: `mobile/hooks/use-home-dashboard.ts`
- ownership adapter: `mobile/lib/home-ownership.ts`
- region carousel: `mobile/components/screens/home/portfolio-carousel.tsx`
- impact section: `mobile/components/screens/home/impact-section.tsx`
- live feed: `mobile/components/screens/home/live-feed.tsx`
