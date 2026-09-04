import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";
import { FAQ_ITEMS } from "@/lib/legal";

export const metadata = { title: "FAQ · Rising Rankers" };

export default function FaqPage() {
  return (
    <LegalShell title="FAQ">
      <div className="space-y-6">
        {FAQ_ITEMS.map((item) => (
          <section key={item.q}>
            <h2 className="font-headline text-base font-extrabold tracking-tight text-[var(--ink)]">{item.q}</h2>
            <p className="mt-2">{item.a}</p>
          </section>
        ))}
      </div>
      <p>
        Still stuck?{" "}
        <Link href="/app/support" className="font-semibold text-[var(--accent)]">
          Open a support ticket
        </Link>
        .
      </p>
    </LegalShell>
  );
}
