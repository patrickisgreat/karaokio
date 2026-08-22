// Package domain holds the entities and rules of karaokio. It imports nothing
// from the rest of the application: storage, transport, and processing all
// depend on this package, never the reverse.
package domain

import "time"

// Status is where a song sits in its life as a request.
type Status string

const (
	StatusQueued     Status = "queued"
	StatusProcessing Status = "processing"
	StatusReady      Status = "ready"
	StatusPlaying    Status = "playing"
	StatusCompleted  Status = "completed"
	StatusFailed     Status = "failed"
)

// Valid reports whether s is a status this application recognises. Persistence
// and transport both validate through here so a typo cannot invent a state the
// queue will never display.
func (s Status) Valid() bool {
	switch s {
	case StatusQueued, StatusProcessing, StatusReady, StatusPlaying, StatusCompleted, StatusFailed:
		return true
	}
	return false
}

// Active reports whether a song still belongs on the party queue. Completed
// and failed songs have left it.
func (s Status) Active() bool {
	switch s {
	case StatusQueued, StatusProcessing, StatusReady, StatusPlaying:
		return true
	}
	return false
}

// Stage is one step of the processing pipeline. Stages are tracked
// individually so the queue can show a guest exactly where their song is
// rather than an opaque percentage.
type Stage string

const (
	StageAcquire  Stage = "acquire"  // obtain source audio
	StageSeparate Stage = "separate" // remove the vocals
	StageLyrics   Stage = "lyrics"   // fetch and time the words
	StageVideo    Stage = "video"    // render something to sing along to
)

// Stages lists the pipeline in execution order.
func Stages() []Stage {
	return []Stage{StageAcquire, StageSeparate, StageLyrics, StageVideo}
}

// StageState is the outcome of a single stage.
type StageState string

const (
	StatePending StageState = "pending"
	StateRunning StageState = "running"
	StateDone    StageState = "done"
	// StateDegraded means the stage produced a usable but lesser result — no
	// synced lyrics, no rendered video. The song still plays. This is the
	// state that makes "degrade, don't fail" visible instead of mysterious.
	StateDegraded StageState = "degraded"
	StateSkipped  StageState = "skipped"
	StateFailed   StageState = "failed"
)

// StageStatus is one row of the per-song progress display.
type StageStatus struct {
	Stage  Stage      `json:"stage"`
	State  StageState `json:"state"`
	Detail string     `json:"detail,omitempty"` // why, in words a guest understands
}

// Artifacts are the files a song accumulates as it is processed. Paths are
// server-side and never leave the process; the transport layer converts them
// into media URLs.
type Artifacts struct {
	SourceAudio  string `json:"-"`
	Instrumental string `json:"-"`
	Vocals       string `json:"-"`
	Lyrics       string `json:"-"`
	Video        string `json:"-"`
}

// Playable reports whether there is enough here to sing to. The instrumental
// alone qualifies: the bottom rung of the ladder is still a karaoke song.
func (a Artifacts) Playable() bool {
	return a.Instrumental != "" || a.Video != ""
}

// Song is a request by one guest for one song.
type Song struct {
	ID        string        `json:"id"`
	Requester User          `json:"requester"`
	Title     string        `json:"title"`
	Artist    string        `json:"artist"`
	Query     string        `json:"query"`
	Status    Status        `json:"status"`
	Detail    string        `json:"detail,omitempty"`
	Stages    []StageStatus `json:"stages"`
	Artifacts Artifacts     `json:"-"`

	RequestedAt time.Time  `json:"requestedAt"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

// Progress is the fraction of the pipeline behind this song, derived from
// stage states rather than stored separately — one source of truth, and it can
// never drift from the stage list the guest is looking at.
func (s *Song) Progress() int {
	all := Stages()
	if len(all) == 0 {
		return 0
	}
	var settled int
	for _, st := range s.Stages {
		switch st.State {
		case StateDone, StateDegraded, StateSkipped, StateFailed:
			settled++
		}
	}
	return settled * 100 / len(all)
}

// StageStatusFor returns the tracked state of one stage, defaulting to pending
// so callers never have to reason about a partially populated list.
func (s *Song) StageStatusFor(stage Stage) StageStatus {
	for _, st := range s.Stages {
		if st.Stage == stage {
			return st
		}
	}
	return StageStatus{Stage: stage, State: StatePending}
}

// SetStage records the outcome of a stage, replacing any previous entry.
func (s *Song) SetStage(stage Stage, state StageState, detail string) {
	for i, st := range s.Stages {
		if st.Stage == stage {
			s.Stages[i] = StageStatus{Stage: stage, State: state, Detail: detail}
			return
		}
	}
	s.Stages = append(s.Stages, StageStatus{Stage: stage, State: state, Detail: detail})
}
