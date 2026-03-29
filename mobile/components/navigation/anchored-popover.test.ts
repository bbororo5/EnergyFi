import { calculateAnchoredPopoverLayout } from '@/components/navigation/anchored-popover';

describe('calculateAnchoredPopoverLayout', () => {
  it('keeps the tail aligned to the anchor after clamping', () => {
    const layout = calculateAnchoredPopoverLayout({
      anchorRect: { x: 320, y: 20, width: 40, height: 40 },
      containerWidth: 390,
      containerHeight: 844,
      preferredWidth: 320,
      horizontalMargin: 12,
      offset: 12,
      tailInset: 42,
      placement: 'bottom-end',
    });

    expect(layout.left).toBeGreaterThanOrEqual(12);
    expect(layout.left + layout.sheetWidth).toBeLessThanOrEqual(390 - 12);
    expect(layout.anchorOffsetX).toBeGreaterThan(0);
    expect(layout.tailLeft).toBeGreaterThan(0);
  });

  it('supports centered placement without pushing the sheet outside the viewport', () => {
    const layout = calculateAnchoredPopoverLayout({
      anchorRect: { x: 150, y: 24, width: 40, height: 40 },
      containerWidth: 390,
      containerHeight: 844,
      preferredWidth: 280,
      horizontalMargin: 12,
      offset: 12,
      tailInset: 42,
      placement: 'bottom-center',
    });

    expect(layout.left).toBeGreaterThanOrEqual(12);
    expect(layout.left + layout.sheetWidth).toBeLessThanOrEqual(390 - 12);
    expect(layout.anchorOffsetX).toBeGreaterThan(0);
  });

  it('supports start placement near the left viewport edge', () => {
    const layout = calculateAnchoredPopoverLayout({
      anchorRect: { x: 8, y: 24, width: 40, height: 40 },
      containerWidth: 390,
      containerHeight: 844,
      preferredWidth: 280,
      horizontalMargin: 12,
      offset: 12,
      tailInset: 42,
      placement: 'bottom-start',
    });

    expect(layout.left).toBe(12);
    expect(layout.anchorOffsetX).toBeGreaterThan(0);
    expect(layout.tailLeft).toBeGreaterThanOrEqual(0);
  });
});
