import { gridLayout } from './MediaGrid';

test.each([320, 390, 768, 1024])('keeps the catalog inside a %d-point window with large text', width => {
  for (const scale of [1, 1.5, 2]) {
    const { columns, cardWidth } = gridLayout(width, scale);
    expect(columns).toBeGreaterThanOrEqual(1);
    expect(cardWidth).toBeGreaterThan(0);
    expect(columns * cardWidth + (columns + 1) * 16).toBeLessThanOrEqual(width);
    expect(columns).toBeLessThanOrEqual(gridLayout(width, 1).columns);
  }
});
