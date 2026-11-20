"use client";
import { Milo } from "@/components/milo/Milo";
import { MeasureEditor } from "@/components/measure/MeasureEditor";

/** For a helper (family, carer, OT) on their phone: step-by-step guides + big buttons. */
export default function MeasurePage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 pb-16 pt-10">
      <div className="mb-8 flex items-center gap-4">
        <Milo size={72} />
        <div>
          <h1 className="text-[30px] font-semibold leading-tight">Help measure for Maria</h1>
          <p className="text-lg text-muted">You’ll need a tape measure. Tap “Change” on each one, follow the steps, then save.</p>
        </div>
      </div>
      <MeasureEditor helperMode />
      <p className="mt-8 text-sm text-muted">Saved measurements are marked “measured by a helper”. Milo still asks a clinician to confirm them for the insurance appeal. Demo data is fictional.</p>
    </main>
  );
}
