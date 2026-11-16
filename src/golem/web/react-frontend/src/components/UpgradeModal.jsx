import React, { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Gem from "./ui/Gem";
import CardImage from "./ui/CardImage";
import CrystalRow from "./ui/CrystalRow";
import { COLORS, of, sub, levels } from "../utils/crystals";

const NEXT = { yellow: "green", green: "blue", blue: "pink" };
const NAME = { yellow: "yellow", green: "green", blue: "blue", pink: "pink" };

/**
 * Upgrade card: each tap raises one crystal by one level (yellow → green → blue → pink), up to the
 * card's number of steps; the same crystal may be raised again. The server gets the crystals given up
 * (input) and the ones received (output), which is the difference between the caravan before and after.
 */
const UpgradeModal = ({ card, playerResources, onConfirm, onCancel, maxTurnUpgrade }) => {
  const start = of(playerResources);
  const [after, setAfter] = useState(start);
  const used = levels(after) - levels(start);
  const left = Math.max(0, (maxTurnUpgrade || 0) - used);

  const raise = (c) => {
    if (left <= 0 || !NEXT[c] || after[c] <= 0) return;
    setAfter((prev) => ({ ...prev, [c]: prev[c] - 1, [NEXT[c]]: prev[NEXT[c]] + 1 }));
  };

  const diff = sub(start, after); // > 0: given up (input), < 0: received (output)
  const inputResources = Object.fromEntries(COLORS.map((c) => [c, Math.max(0, diff[c])]));
  const outputResources = Object.fromEntries(COLORS.map((c) => [c, Math.max(0, -diff[c])]));
  const canConfirm = used > 0;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Upgrade Crystals"
      icon={card?.name ? <CardImage name={card.name} className="h-14 w-10 rounded-stone-sm border border-ink/30" /> : null}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          {used > 0 ? <Button variant="outline" onClick={() => setAfter(start)}>Reset</Button> : null}
          <Button onClick={() => canConfirm && onConfirm(inputResources, outputResources)} disabled={!canConfirm}>Confirm Upgrade</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-ink-muted">
          Tap a crystal to raise it one level.{" "}
          <span className="font-semibold text-ink">{left} of {maxTurnUpgrade} upgrade{maxTurnUpgrade === 1 ? "" : "s"} left</span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {COLORS.filter((c) => NEXT[c]).map((c) => {
            const can = left > 0 && after[c] > 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => raise(c)}
                disabled={!can}
                aria-label={`Upgrade one ${NAME[c]} to ${NAME[NEXT[c]]} (you have ${after[c]})`}
                className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-stone border border-ink/25 bg-ink/5 px-2 py-2
                  transition-colors hover:border-bronze-700 hover:bg-bronze-300/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-1.5">
                  <Gem color={c} size={22} label={false} />
                  <span aria-hidden="true" className="text-ink-muted">→</span>
                  <Gem color={NEXT[c]} size={22} label={false} />
                </span>
                <span className="text-xs font-semibold text-ink-muted">have {after[c]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 rounded-stone border border-ink/15 bg-ink/5 px-3 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-center gap-2 text-ink-muted">
            Before: <CrystalRow resources={start} size="sm" tone="parchment" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 font-semibold text-ink">
            After: <CrystalRow resources={after} size="sm" tone="parchment" />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UpgradeModal;
