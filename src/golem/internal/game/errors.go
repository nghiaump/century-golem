package game

import "errors"

// Sentinel errors returned by Validate/Step/ExecuteAction. Callers can match them with errors.Is;
// the wrapped messages carry the details.
var (
	ErrGameOver          = errors.New("game is over")
	ErrMustDiscard       = errors.New("must discard excess crystals first")
	ErrNoDiscard         = errors.New("no discard needed")
	ErrInvalidIndex      = errors.New("invalid card index")
	ErrCannotPlay        = errors.New("cannot play card")
	ErrBadDeposits       = errors.New("invalid deposits")
	ErrCannotClaim       = errors.New("cannot claim point card")
	ErrInvalidResources  = errors.New("invalid resources")
	ErrUnknownActionType = errors.New("unknown action type")
)
