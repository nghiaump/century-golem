package sim

// ActKind is the kind of a move.
type ActKind uint8

const (
	APlay ActKind = iota
	AAcquire
	AClaim
	ARest
	ADiscard
)

// Action is a move in canonical form.
//   - APlay:    Card = merchant index; Mult = trade multiplier; Vec = crystals AFTER an upgrade.
//   - AAcquire: Card = market position; Vec = multiset of crystals placed (cheapest on the left).
//   - AClaim:   Card = golem row position.
//   - ADiscard: Vec = crystals discarded.
type Action struct {
	Kind ActKind
	Card uint8
	Mult uint8
	Vec  Crystals
}

// Key packs an action into a uint64 (unique per distinct action).
func (a Action) Key() uint64 {
	return uint64(a.Kind) | uint64(a.Card)<<8 | uint64(a.Mult)<<16 |
		uint64(uint8(a.Vec[0]))<<24 | uint64(uint8(a.Vec[1]))<<32 |
		uint64(uint8(a.Vec[2]))<<40 | uint64(uint8(a.Vec[3]))<<48
}

// GenMode selects how much of the combinatorics move generation enumerates.
type GenMode uint8

const (
	// Full enumerates the same canonical set as game.AppendLegalActions with no limits.
	Full GenMode = iota
	// Search keeps at most 2 deposit variants per market position and 3 discard options.
	Search
)

// AppendLegal appends the legal moves of the player to move.
func (s *State) AppendLegal(dst []Action, mode GenMode) []Action {
	if s.Over {
		return dst
	}
	p := s.Cur()
	if p.Pending > 0 {
		var buf [msBufSize]Crystals
		n := multisets(p.Res, int(p.Pending), &buf)
		if mode == Search && n > 3 {
			n = 3
		}
		for i := 0; i < n; i++ {
			dst = append(dst, Action{Kind: ADiscard, Vec: buf[i]})
		}
		return dst
	}

	for h := p.Hand; h != 0; h &= h - 1 {
		m := uint8(trailingZeros(h))
		d := &Merchants[m]
		switch d.Kind {
		case KProduce:
			dst = append(dst, Action{Kind: APlay, Card: m, Mult: 1})
		case KUpgrade:
			var buf [upBufSize]Crystals
			n := upgradeResults(p.Res, d.Steps, &buf)
			for i := 0; i < n; i++ {
				dst = append(dst, Action{Kind: APlay, Card: m, Mult: 1, Vec: buf[i]})
			}
		case KTrade:
			for t := int8(1); t <= p.Res.MaxTimes(d.In); t++ {
				dst = append(dst, Action{Kind: APlay, Card: m, Mult: uint8(t)})
			}
		}
	}

	for k := 0; k < int(s.NMarket); k++ {
		if k == 0 {
			dst = append(dst, Action{Kind: AAcquire, Card: 0})
			continue
		}
		var buf [msBufSize]Crystals
		n := multisets(p.Res, k, &buf)
		if mode == Search && n > 2 {
			n = 2
		}
		for i := 0; i < n; i++ {
			dst = append(dst, Action{Kind: AAcquire, Card: uint8(k), Vec: buf[i]})
		}
	}

	for j := 0; j < int(s.NRow); j++ {
		if p.Res.Covers(Golems[s.Row[j]].Req, 1) {
			dst = append(dst, Action{Kind: AClaim, Card: uint8(j)})
		}
	}
	return append(dst, Action{Kind: ARest})
}

const (
	upBufSize = 64
	msBufSize = 320
)

// upgradeResults writes every distinct crystal vector reachable with 1..steps single level-ups.
func upgradeResults(res Crystals, steps int8, out *[upBufSize]Crystals) int {
	n := 0
	var frontier, next [upBufSize]Crystals
	frontier[0] = res
	nf := 1
	for s := int8(0); s < steps; s++ {
		nn := 0
		for f := 0; f < nf; f++ {
			v := frontier[f]
			for c := 0; c < 3; c++ {
				if v[c] == 0 {
					continue
				}
				w := v
				w[c]--
				w[c+1]++
				if w == res || contains(out[:n], w) {
					continue
				}
				if n < upBufSize {
					out[n] = w
					n++
				}
				if nn < upBufSize {
					next[nn] = w
					nn++
				}
			}
		}
		frontier, nf = next, nn
	}
	return n
}

func contains(a []Crystals, v Crystals) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}

// multisets writes the distinct multisets of k crystals drawn from res, cheapest level first.
func multisets(res Crystals, k int, out *[msBufSize]Crystals) int {
	if k <= 0 || res.Total() < k {
		return 0
	}
	n := 0
	for y := 0; y <= min(int(res[0]), k); y++ {
		for g := 0; g <= min(int(res[1]), k-y); g++ {
			for b := 0; b <= min(int(res[2]), k-y-g); b++ {
				p := k - y - g - b
				if p <= int(res[3]) && n < msBufSize {
					out[n] = Crystals{int8(y), int8(g), int8(b), int8(p)}
					n++
				}
			}
		}
	}
	// insertion sort by level (stable: equal levels keep enumeration order, like game.multisets)
	for i := 1; i < n; i++ {
		v := out[i]
		lv := v.Level()
		j := i - 1
		for j >= 0 && out[j].Level() > lv {
			out[j+1] = out[j]
			j--
		}
		out[j+1] = v
	}
	return n
}

func trailingZeros(x uint64) int {
	n := 0
	for x&1 == 0 {
		x >>= 1
		n++
	}
	return n
}
