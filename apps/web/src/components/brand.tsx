export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/brand/logo.png"
      alt="Rising Rankers"
      width={size}
      height={size}
      className="brand-mark"
      style={{ width: size, height: size }}
    />
  );
}
