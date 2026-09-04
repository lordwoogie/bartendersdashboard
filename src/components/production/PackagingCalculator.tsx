"use client";

import { useEffect, useMemo, useState } from "react";
import { btn } from "./shared";

// Packaging run calculator: given a tank of beer and a planned split of
// kegs and cases, shows what's left (or how short you are) and how much of
// each package the remainder could still become. Lives in a side panel on
// the schedule while it's in edit mode, so the head brewer can size a
// canning or kegging day while writing it onto the board.
//
// Volumes are US barrels: 1 bbl = 31 gal = 3,968 fl oz.

const GAL_PER_BBL = 31;
const OZ_PER_BBL = GAL_PER_BBL * 128;
const KEG = {
  half: { label: "1/2 bbl kegs", hint: "15.5 gal each", oz: OZ_PER_BBL / 2 },
  sixth: { label: "1/6 bbl kegs", hint: "5.17 gal each", oz: OZ_PER_BBL / 6 },
};
const CAN_SIZES = [12, 16, 19.2];

const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const n1 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gal = (oz: number) => oz / 128;
const bbl = (oz: number) => oz / OZ_PER_BBL;

const field = `${btn.input} tabular-nums`;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-ink">{label}</span>
      {hint && <span className="ml-2 text-xs text-slate">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stepper({
  value,
  onChange,
  max,
  name,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  name: string;
}) {
  const set = (v: number | string) => onChange(Math.max(0, Math.floor(Number(v) || 0)));
  const side = "px-4 text-xl font-bold text-slate hover:bg-green-tint hover:text-green transition-colors duration-150";
  return (
    <div>
      <div className="flex items-stretch overflow-hidden rounded-md border-2 border-line bg-paper focus-within:border-green">
        <button type="button" onClick={() => set(value - 1)} aria-label={`One fewer ${name}`} className={side}>
          −
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="w-full py-2 text-center text-lg font-bold tabular-nums text-ink bg-paper focus:outline-none"
        />
        <button type="button" onClick={() => set(value + 1)} aria-label={`One more ${name}`} className={side}>
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => set(max)}
        className="mt-1 text-xs font-bold text-green hover:underline underline-offset-4"
      >
        Fill the rest with these ({n0(max)} fit)
      </button>
    </div>
  );
}

function Row({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`h-3 w-3 flex-none rounded-sm ${swatch}`} />
      <span className="flex-1 text-ink">{label}</span>
      <span className="tabular-nums text-slate">{value}</span>
    </li>
  );
}

export function PackagingCalculator() {
  const [tank, setTank] = useState("30");
  const [loss, setLoss] = useState("0");
  const [half, setHalf] = useState(10);
  const [sixth, setSixth] = useState(20);
  const [cases, setCases] = useState(300);
  const [canOz, setCanOz] = useState(12);
  const [caseSize, setCaseSize] = useState("24");

  const r = useMemo(() => {
    const tankBbl = Math.max(0, parseFloat(tank) || 0);
    const lossPct = Math.min(100, Math.max(0, parseFloat(loss) || 0));
    const perCase = Math.max(1, Math.floor(parseFloat(caseSize) || 24));
    const caseOz = perCase * canOz;

    const totalOz = tankBbl * OZ_PER_BBL;
    const lossOz = totalOz * (lossPct / 100);
    const usableOz = totalOz - lossOz;

    const halfOz = half * KEG.half.oz;
    const sixthOz = sixth * KEG.sixth.oz;
    const cansOz = cases * caseOz;
    const cans = cases * perCase;
    const plannedOz = halfOz + sixthOz + cansOz;

    const leftOz = usableOz - plannedOz;
    const over = leftOz < 0;

    const leftCans = over ? 0 : Math.floor(leftOz / canOz);
    const leftCases = Math.floor(leftCans / perCase);
    const leftLoose = leftCans - leftCases * perCase;

    const maxHalf = Math.max(0, Math.floor((usableOz - sixthOz - cansOz) / KEG.half.oz));
    const maxSixth = Math.max(0, Math.floor((usableOz - halfOz - cansOz) / KEG.sixth.oz));
    const maxCases = Math.max(0, Math.floor((usableOz - halfOz - sixthOz) / caseOz));

    const allCases = Math.floor(usableOz / caseOz);
    const allHalf = Math.floor(usableOz / KEG.half.oz);
    const allSixth = Math.floor(usableOz / KEG.sixth.oz);

    // Gauge segments as % of the full tank; the planned portion is capped at
    // what's usable so an over-planned run can't paint past the top.
    const pct = (oz: number) => (totalOz > 0 ? Math.max(0, (oz / totalOz) * 100) : 0);
    let pHalf = pct(halfOz);
    let pSixth = pct(sixthOz);
    let pCans = pct(cansOz);
    const usablePct = 100 - pct(lossOz);
    const planned = pHalf + pSixth + pCans;
    if (planned > usablePct && planned > 0) {
      const s = usablePct / planned;
      pHalf *= s;
      pSixth *= s;
      pCans *= s;
    }

    return {
      tankBbl, lossPct, perCase, totalOz, lossOz, usableOz,
      halfOz, sixthOz, cansOz, cans, plannedOz, leftOz, over,
      leftCans, leftCases, leftLoose, maxHalf, maxSixth, maxCases,
      allCases, allHalf, allSixth,
      gauge: { half: pHalf, sixth: pSixth, cans: pCans, left: over ? 0 : pct(leftOz) },
    };
  }, [tank, loss, half, sixth, cases, canOz, caseSize]);

  const seg = (h: number) => ({ height: `${h}%`, transition: "height 240ms ease" });

  return (
    <div className="space-y-5">
      {/* Headline result */}
      <section className="bg-paper border-2 border-line rounded-lg p-4">
        <div className="flex gap-5">
          <div className="flex flex-col items-center">
            <div
              className="flex flex-col-reverse overflow-hidden rounded-full bg-paper border-[3px] border-ink"
              style={{ width: 56, height: 220 }}
              aria-hidden="true"
            >
              <div className="bg-purple" style={seg(r.gauge.half)} />
              <div className="bg-blue" style={seg(r.gauge.sixth)} />
              <div className="bg-yellow" style={seg(r.gauge.cans)} />
              <div className="bg-cream" style={seg(r.gauge.left)} />
            </div>
            <span className="mt-2 text-xs font-bold text-slate">{n0(r.tankBbl)} bbl</span>
          </div>

          <div className="flex-1 min-w-0">
            {r.over ? (
              <>
                <p className="eyebrow text-critical">Short by</p>
                <p className="text-5xl font-bold leading-none tracking-tight tabular-nums text-critical mt-1">
                  {n2(bbl(-r.leftOz))}
                  <span className="ml-1.5 text-xl">bbl</span>
                </p>
                <p className="mt-2 text-sm text-ink">
                  That&apos;s {n1(gal(-r.leftOz))} gal more than the tank has. Lower a keg count, the case
                  count, or the loss.
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow text-slate">Left after this run</p>
                <p className="text-5xl font-bold leading-none tracking-tight tabular-nums text-ink mt-1">
                  {n2(bbl(r.leftOz))}
                  <span className="ml-1.5 text-xl text-slate">bbl</span>
                </p>
                <p className="mt-2 text-sm text-ink">
                  {r.leftCans === 0 ? (
                    <span className="font-bold text-green">Tank fully packaged.</span>
                  ) : (
                    <>
                      {n1(gal(r.leftOz))} gal, enough for {n0(r.leftCans)} more cans
                      {r.leftCases > 0 && (
                        <span className="text-slate">
                          {" "}
                          ({n0(r.leftCases)} cases{r.leftLoose > 0 ? ` + ${r.leftLoose} loose` : ""})
                        </span>
                      )}
                    </>
                  )}
                </p>
              </>
            )}

            <ul className="mt-4 space-y-1.5 text-sm">
              <Row swatch="bg-purple" label={`${n0(half)} × 1/2 bbl`} value={`${n1(gal(r.halfOz))} gal`} />
              <Row swatch="bg-blue" label={`${n0(sixth)} × 1/6 bbl`} value={`${n1(gal(r.sixthOz))} gal`} />
              <Row
                swatch="bg-yellow"
                label={`${n0(cases)} cases (${n0(r.cans)} × ${canOz} oz)`}
                value={`${n1(gal(r.cansOz))} gal`}
              />
              {!r.over && (
                <Row swatch="bg-cream border-2 border-line" label="Left in tank" value={`${n1(gal(r.leftOz))} gal`} />
              )}
              {r.lossOz > 0 && (
                <Row swatch="border-2 border-line" label={`Loss (${n1(r.lossPct)}%)`} value={`${n1(gal(r.lossOz))} gal`} />
              )}
              <li className="flex items-center gap-3 border-t-2 border-line pt-2 font-bold text-ink">
                <span className="h-3 w-3 flex-none" />
                <span className="flex-1">Packaged</span>
                <span className="tabular-nums">
                  {n2(bbl(r.plannedOz))} of {n2(bbl(r.usableOz))} bbl
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section className="bg-cream border-2 border-line rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Beer in tank" hint={`${n1(gal(r.totalOz))} gal`}>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={tank}
                onChange={(e) => setTank(e.target.value)}
                className={`${field} pr-12`}
              />
              <span className="absolute right-3 top-2 text-base text-slate">bbl</span>
            </div>
          </Field>
          <Field label="Loss" hint={`${n1(gal(r.lossOz))} gal`}>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                inputMode="decimal"
                value={loss}
                onChange={(e) => setLoss(e.target.value)}
                className={`${field} pr-9`}
              />
              <span className="absolute right-3 top-2 text-base text-slate">%</span>
            </div>
          </Field>
        </div>

        <div className="border-t-2 border-line pt-4 space-y-4">
          <Field label={KEG.half.label} hint={KEG.half.hint}>
            <Stepper value={half} onChange={setHalf} max={r.maxHalf} name="half barrel" />
          </Field>
          <Field label={KEG.sixth.label} hint={KEG.sixth.hint}>
            <Stepper value={sixth} onChange={setSixth} max={r.maxSixth} name="sixth barrel" />
          </Field>
          <Field label={`Cases of ${r.perCase}`} hint={`${n1(gal(r.perCase * canOz))} gal each`}>
            <Stepper value={cases} onChange={setCases} max={r.maxCases} name="case" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t-2 border-line pt-4">
          <Field label="Can size">
            <select value={canOz} onChange={(e) => setCanOz(parseFloat(e.target.value))} className={field}>
              {CAN_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} oz
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cans per case">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={caseSize}
              onChange={(e) => setCaseSize(e.target.value)}
              className={field}
            />
          </Field>
        </div>
      </section>

      {/* Whole-tank references */}
      <section>
        <p className="eyebrow text-slate mb-2">If the whole tank went one way</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-yellow-tint border-2 border-line rounded-md px-3 py-2">
            <span className="block text-lg font-bold tabular-nums text-ink leading-tight">{n0(r.allCases)}</span>
            <span className="text-xs text-slate">cases · {n0(r.allCases * r.perCase)} cans</span>
          </div>
          <div className="bg-purple-tint border-2 border-line rounded-md px-3 py-2">
            <span className="block text-lg font-bold tabular-nums text-ink leading-tight">{n0(r.allHalf)}</span>
            <span className="text-xs text-slate">1/2 bbl kegs</span>
          </div>
          <div className="bg-blue-tint border-2 border-line rounded-md px-3 py-2">
            <span className="block text-lg font-bold tabular-nums text-ink leading-tight">{n0(r.allSixth)}</span>
            <span className="text-xs text-slate">1/6 bbl kegs</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate">1 bbl = 31 gal = 3,968 oz</p>
      </section>
    </div>
  );
}

// Side panel that holds the calculator while the schedule is being edited.
// It stays mounted (just hidden) between opens so the numbers survive
// closing it to type on the board; it unmounts when editing ends.
export function PackagingDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      hidden={!open}
      aria-label="Packaging run calculator"
      className="no-print fixed inset-y-0 right-0 z-40 w-full sm:w-[27rem] bg-paper-2 border-l-2 border-ink shadow-block flex flex-col"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-green text-paper border-b-2 border-green-deep">
        <div>
          <h2 className="font-bold text-lg leading-tight">Packaging run</h2>
          <p className="text-xs text-paper/80">Size a canning or kegging day.</p>
        </div>
        <button type="button" onClick={onClose} className={btn.onGreen}>
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <PackagingCalculator />
      </div>
    </aside>
  );
}
