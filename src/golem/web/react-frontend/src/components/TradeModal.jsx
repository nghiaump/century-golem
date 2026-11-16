import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Stepper from "./ui/Stepper";
import CardImage from "./ui/CardImage";
import CrystalRow, { CrystalCost } from "./ui/CrystalRow";
import { COLORS, MAX_CARAVAN, add, sub, times, total } from "../utils/crystals";

// How many times the trade fits in the caravan (0 = not even once).
function maxTimes(card, res) {
  let max = Infinity;
  let any = false;
  for (const c of COLORS) {
    const need = card?.input?.[c] || 0;
    if (need > 0) {
      any = true;
      max = Math.min(max, Math.floor((res?.[c] || 0) / need));
    }
  }
  return any && max !== Infinity ? Math.max(0, max) : 0;
}

/** Trade card: choose how many times to run it (×1…×max), see what you pay, get and end up with. */
const TradeModal = ({ card, playerResources, onConfirm, onCancel }) => {
  const maxMultiplier = card?.input && playerResources ? maxTimes(card, playerResources) : 0;
  const [multiplier, setMultiplier] = useState(maxMultiplier > 0 ? 1 : 0);
  const [error, setError] = useState("");

  const requiredInput = times(card?.input, multiplier);
  const outputResult = times(card?.output, multiplier);
  const after = add(sub(playerResources, requiredInput), outputResult);
  const overflow = total(after) - MAX_CARAVAN;

  const validate = (m) => {
    if (m < 1) return "Multiplier must be at least 1";
    if (m > maxMultiplier) return `Max ${maxMultiplier} times`;
    const need = times(card?.input, m);
    if (COLORS.some((c) => need[c] > (playerResources?.[c] || 0))) return "Not enough resources";
    return "";
  };

  // keep the multiplier inside 1..max when the caravan changes
  useEffect(() => {
    setMultiplier((prev) => (maxMultiplier === 0 ? 0 : Math.min(Math.max(prev, 1), maxMultiplier)));
  }, [maxMultiplier]);

  useEffect(() => {
    setError(validate(multiplier));
  }, [multiplier, maxMultiplier]); // eslint-disable-line react-hooks/exhaustive-deps

  const canConfirm = !error && multiplier >= 1;
  const handleConfirm = () => {
    const err = validate(multiplier);
    setError(err);
    if (!err && typeof onConfirm === "function") onConfirm(multiplier);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Trade"
      icon={card?.name ? <CardImage name={card.name} className="h-14 w-10 rounded-stone-sm border border-ink/30" /> : null}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>Confirm Trade</Button>
        </>
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-1.5 rounded-stone border border-ink/15 bg-ink/5 px-2 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">You pay</span>
            <CrystalCost resources={requiredInput} size={26} max={6} className="justify-center" />
          </div>
          <span aria-hidden="true" className="font-display text-2xl text-ink-muted">→</span>
          <div className="flex flex-col items-center gap-1.5 rounded-stone border border-ink/15 bg-ink/5 px-2 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">You get</span>
            <CrystalCost resources={outputResult} size={26} max={6} className="justify-center" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <Stepper
            label="trades"
            value={multiplier}
            min={maxMultiplier > 0 ? 1 : 0}
            max={maxMultiplier}
            onChange={setMultiplier}
            format={(v) => `×${v}`}
          />
          <span className="text-xs text-ink-muted">You can trade up to ×{maxMultiplier}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted">
          After: <CrystalRow resources={after} capacity={MAX_CARAVAN} size="sm" tone="parchment" />
        </div>

        {error ? (
          <p role="alert" className="w-full rounded-stone-sm border border-ember/50 bg-ember/10 px-3 py-2 text-center text-sm font-semibold text-[rgb(140_40_20)]">
            {error}
          </p>
        ) : overflow > 0 ? (
          <p className="w-full rounded-stone-sm border border-bronze-700/50 bg-bronze-300/25 px-3 py-2 text-center text-sm text-ink">
            You will have {total(after)} crystals and must discard {overflow}. Lower the multiplier to keep them all.
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

export default TradeModal;
