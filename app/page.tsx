import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

const SCREENS = ["1", "2", "3"];

const PREVIEWS = [
  { href: "/screen/1?theme=dark", label: "Donker thema" },
  { href: "/screen/1?accent=blue", label: "Accent blauw" },
  { href: "/screen/1?accent=gold", label: "Accent goud" },
  { href: "/screen/1?takeover=1", label: "Big Slide — volledig scherm" },
  { href: "/screen/1?event=1", label: "Evenement — poster" },
  { href: "/screen/1?occasion=1", label: "Speciale gelegenheid" },
  { href: "/screen/1?keypanel=1", label: "Sleutels — hoofdvlak" },
  { href: "/screen/1?keys=3", label: "Sleutels — in mededelingen" },
  { href: "/screen/1?now=11:20", label: "Lesuur 3 bezig" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[36rem] flex-col justify-center gap-[1.2rem] p-[2rem]">
      <div className="flex items-center gap-[0.8rem]">
        <BrandMark className="h-[2.4rem] w-auto" />
        <div>
          <p className="eyebrow text-[0.7rem]">Steinerschool Gent</p>
          <h1 className="font-display text-[1.8rem] font-bold leading-tight">
            Infoborden
          </h1>
        </div>
      </div>

      <p className="text-[0.95rem] leading-relaxed text-muted">
        Open een schermlink in Chromium kiosk-modus op de bijbehorende
        Raspberry&nbsp;Pi.
      </p>

      <ul className="flex flex-col gap-[0.6rem]">
        {SCREENS.map((id) => (
          <li key={id}>
            <Link
              href={`/screen/${id}`}
              className="flex items-center justify-between rounded-md border-[0.075rem] border-line bg-surface-1 px-[1.2rem] py-[0.9rem] hover:bg-surface-2"
            >
              <span className="font-display text-[1.2rem] font-bold">
                Scherm {id}
              </span>
              <span className="font-mono text-[0.75rem] text-muted">
                /screen/{id}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div>
        <p className="eyebrow pb-[0.6rem] text-[0.7rem]">Varianten bekijken</p>
        <div className="flex flex-wrap gap-[0.5rem]">
          {PREVIEWS.map((preview) => (
            <Link
              key={preview.href}
              href={preview.href}
              className="rounded-sm border-[0.075rem] border-line bg-surface-2 px-[0.9rem] py-[0.5rem] text-[0.85rem] font-bold text-muted hover:text-text"
            >
              {preview.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
