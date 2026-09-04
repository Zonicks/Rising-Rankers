export function PageHeader({
  overline,
  title,
  subtitle,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-10">
      {overline ? <p className="page-kicker">{overline}</p> : null}
      <h1 className={`font-headline text-3xl font-extrabold tracking-tight ${overline ? "mt-2" : ""}`}>
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{subtitle}</p> : null}
    </header>
  );
}
