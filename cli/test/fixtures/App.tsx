import { useState } from 'react';
type P = Array<number>;
export function App({ items }: { items: string[] }) {
  const [v, setV] = useState<number>(0);
  const ok = v < 3 && v > 1;
  return (
    <>
      <tr-panel depth={2} className="x" key="a">
        <tr-button tone="primary" onClick={() => setV(v + 1)}>{label}</tr-button>
        <tr-button tone="accent" />
        {items.map((i) => (
          <tr-option value={i} key={i}>{i}</tr-option>
        ))}
        {/* comment */}
        <Icon name="x" />
        <tr-slider label="Vol" max={100} valueText={`${v}%`} fancy="1"></tr-slider>
        <tr-button aria-label="Close dialog">Cancel</tr-button>
      </tr-panel>
    </>
  );
}
