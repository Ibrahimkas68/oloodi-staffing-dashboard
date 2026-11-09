/**
 * KPI number that pops in when its value changes (200 ms: opacity, translateY, scale).
 * Keyed by value, so only the changed number animates. Reduced motion: swaps instantly.
 */
export function PopNumber({ value }: { value: number }) {
  return (
    <span key={value} className="inline-block animate-pop">
      {value}
    </span>
  );
}
