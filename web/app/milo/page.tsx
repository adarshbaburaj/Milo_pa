"use client";
import { Milo } from "@/components/milo/Milo";
import { milo, MiloState } from "@/components/milo/useMilo";
import { Button, PageTitle } from "@/components/ui";

const STATES: MiloState[] = ["idle", "listening", "thinking", "happy", "speaking", "confused", "celebrate", "waiting", "sleep"];

export default function MiloDemo() {
  return (
    <div>
      <PageTitle title="Milo states" subtitle="Demo page to cycle every state." />
      <div className="mb-8 flex justify-center py-8"><Milo size={96} /></div>
      <div className="grid grid-cols-3 gap-6">
        {STATES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-3 rounded-lg bg-surface py-6">
            <Milo size={64} state={s} />
            <span className="text-sm text-muted">{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {(["happy", "confused", "celebrate"] as MiloState[]).map((s) => (
          <Button key={s} onClick={() => milo.react(s)}>react(“{s}”)</Button>
        ))}
        {(["listening", "thinking", "speaking", "waiting", "sleep"] as const).map((f) => (
          <Button key={f} onClick={() => { milo.set(f, true); setTimeout(() => milo.set(f, false), 2500); }}>{f} 2.5 s</Button>
        ))}
      </div>
    </div>
  );
}
