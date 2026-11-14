package game

import "sort"

// LegalOptions limits the combinatorial parts of move generation (0 = no limit).
type LegalOptions struct {
	MaxDepositVariants int // per market position, cheapest multisets first
	MaxDiscardVariants int // cheapest multisets first
}

// LegalActions returns every distinct legal action for the current player (canonical encodings).
func (gs *GameState) LegalActions() []Action {
	return gs.AppendLegalActions(nil, LegalOptions{})
}

// AppendLegalActions appends the legal actions for the current player to dst.
//
// Canonical encodings keep the set small without losing distinct outcomes:
//   - Upgrade: one action per distinct resulting crystal vector, encoded minimally (UpgradeIO);
//   - Trade: one action per multiplier 1..max;
//   - Acquire k: one action per distinct multiset of k crystals to place, placed cheapest-first
//     from the left (which card receives which colour is not branched on);
//   - Discard (only legal action while a discard is pending): one per distinct multiset.
func (gs *GameState) AppendLegalActions(dst []Action, o LegalOptions) []Action {
	if gs.GameOver {
		return dst
	}
	p := gs.GetCurrentPlayer()
	res := *p.Resources

	if p.PendingDiscard > 0 {
		opts := DiscardOptions(res, p.PendingDiscard)
		if o.MaxDiscardVariants > 0 && len(opts) > o.MaxDiscardVariants {
			opts = opts[:o.MaxDiscardVariants]
		}
		for _, d := range opts {
			dc := d
			dst = append(dst, Action{Type: Discard, DiscardResources: &dc})
		}
		return dst
	}

	for i, card := range p.Hand {
		if card.Type != ActionCard {
			continue
		}
		switch card.ActionType {
		case Produce:
			dst = append(dst, Action{Type: PlayCard, CardIndex: i, Multiplier: 1})
		case Upgrade:
			for _, after := range UpgradeResults(res, card.TurnUpgrade) {
				in, out := UpgradeIO(res, after)
				dst = append(dst, Action{Type: PlayCard, CardIndex: i, Multiplier: 1,
					InputResources: &in, OutputResources: &out})
			}
		case Trade:
			for m := 1; m <= res.GetMaxMultiplier(card.Input); m++ {
				dst = append(dst, Action{Type: PlayCard, CardIndex: i, Multiplier: m})
			}
		}
	}

	for k := range gs.Market.ActionCards {
		if k == 0 {
			dst = append(dst, Action{Type: AcquireCard, CardIndex: 0, DepositList: []DepositData{}})
			continue
		}
		sets := DepositMultisets(res, k)
		if o.MaxDepositVariants > 0 && len(sets) > o.MaxDepositVariants {
			sets = sets[:o.MaxDepositVariants]
		}
		for _, set := range sets {
			dst = append(dst, Action{Type: AcquireCard, CardIndex: k, DepositList: DepositsFromMultiset(set)})
		}
	}

	for j, card := range gs.Market.PointCards {
		if card.CanClaim(p) {
			dst = append(dst, Action{Type: ClaimPointCard, CardIndex: j})
		}
	}

	return append(dst, Action{Type: Rest})
}

// UpgradeResults returns every distinct crystal vector reachable from `res` with 1..steps single
// level-ups (yellow→green→blue→pink; pink cannot go up). The starting vector is excluded.
func UpgradeResults(res Resources, steps int) []Resources {
	start := res.Vec()
	seen := map[[4]int]bool{start: true}
	frontier := [][4]int{start}
	var out []Resources
	for s := 0; s < steps; s++ {
		var next [][4]int
		for _, v := range frontier {
			for c := 0; c < 3; c++ {
				if v[c] == 0 {
					continue
				}
				w := v
				w[c]--
				w[c+1]++
				if !seen[w] {
					seen[w] = true
					next = append(next, w)
					out = append(out, *ResourcesFromVec(w))
				}
			}
		}
		frontier = next
	}
	return out
}

// UpgradeIO encodes the move before→after minimally: `in` holds the crystals that disappear,
// `out` the crystals that appear (the negative and positive parts of after−before).
func UpgradeIO(before, after Resources) (in, out Resources) {
	b, a := before.Vec(), after.Vec()
	var iv, ov [4]int
	for c := 0; c < 4; c++ {
		if d := a[c] - b[c]; d > 0 {
			ov[c] = d
		} else {
			iv[c] = -d
		}
	}
	return *ResourcesFromVec(iv), *ResourcesFromVec(ov)
}

// DepositMultisets returns the distinct multisets of k crystals the player can place, cheapest
// (lowest total level) first.
func DepositMultisets(res Resources, k int) []Resources { return multisets(res, k) }

// DiscardOptions returns the distinct multisets of n crystals the player can discard, cheapest first.
func DiscardOptions(res Resources, n int) []Resources { return multisets(res, n) }

// DepositsFromMultiset expands a multiset into a deposit list, cheapest colour on the leftmost card.
func DepositsFromMultiset(set Resources) []DepositData {
	out := make([]DepositData, 0, set.Total())
	for c := Yellow; c <= Pink; c++ {
		for n := set.Get(c); n > 0; n-- {
			out = append(out, DepositData{Crystal: c})
		}
	}
	return out
}

func multisets(res Resources, k int) []Resources {
	if k <= 0 || res.Total() < k {
		return nil
	}
	have := res.Vec()
	var out []Resources
	for y := 0; y <= min(have[0], k); y++ {
		for g := 0; g <= min(have[1], k-y); g++ {
			for b := 0; b <= min(have[2], k-y-g); b++ {
				p := k - y - g - b
				if p <= have[3] {
					out = append(out, Resources{Yellow: y, Green: g, Blue: b, Pink: p})
				}
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].GetLevels() < out[j].GetLevels() })
	return out
}
