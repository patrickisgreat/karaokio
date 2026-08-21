package domain

import "testing"

func TestProgressDerivesFromStagesRatherThanBeingStored(t *testing.T) {
	// Progress is computed so it can never disagree with the stage list the
	// guest is looking at — the failure mode of a separately stored percentage.
	s := &Song{}
	if got := s.Progress(); got != 0 {
		t.Errorf("a song with no stages recorded should read 0%%, got %d", got)
	}

	s.SetStage(StageAcquire, StateDone, "")
	if got := s.Progress(); got != 25 {
		t.Errorf("one of four stages settled should read 25%%, got %d", got)
	}

	s.SetStage(StageSeparate, StateDone, "")
	s.SetStage(StageLyrics, StateDegraded, "no synced lyrics found")
	s.SetStage(StageVideo, StateSkipped, "")
	if got := s.Progress(); got != 100 {
		t.Errorf("degraded and skipped stages are settled, so this song is done at 100%%, got %d", got)
	}
}

func TestRunningStagesDoNotCountAsProgress(t *testing.T) {
	s := &Song{}
	s.SetStage(StageAcquire, StateDone, "")
	s.SetStage(StageSeparate, StateRunning, "")
	if got := s.Progress(); got != 25 {
		t.Errorf("an in-flight stage is not progress yet, expected 25%%, got %d", got)
	}
}

func TestSetStageReplacesRatherThanAppends(t *testing.T) {
	// A stage moves pending -> running -> done; each update must overwrite, or
	// the guest sees the same stage listed three times.
	s := &Song{}
	s.SetStage(StageSeparate, StateRunning, "")
	s.SetStage(StageSeparate, StateDone, "")

	if len(s.Stages) != 1 {
		t.Fatalf("expected one entry for a stage updated twice, got %d", len(s.Stages))
	}
	if s.Stages[0].State != StateDone {
		t.Errorf("expected the latest state to win, got %q", s.Stages[0].State)
	}
}

func TestStageStatusForDefaultsToPending(t *testing.T) {
	// Callers should never have to distinguish "not started" from "absent".
	s := &Song{}
	got := s.StageStatusFor(StageVideo)
	if got.State != StatePending {
		t.Errorf("an untracked stage should read pending, got %q", got.State)
	}
	if got.Stage != StageVideo {
		t.Errorf("the returned status should name the stage asked for, got %q", got.Stage)
	}
}

func TestDegradedStageCarriesItsReason(t *testing.T) {
	// "Degrade, don't fail" is only usable if the UI can say why.
	s := &Song{}
	s.SetStage(StageLyrics, StateDegraded, "no synced lyrics found — showing scrolling text")

	got := s.StageStatusFor(StageLyrics)
	if got.State != StateDegraded {
		t.Errorf("expected degraded, got %q", got.State)
	}
	if got.Detail == "" {
		t.Error("a degraded stage without a reason is indistinguishable from a bug")
	}
}

func TestArtifactsArePlayableWithAudioAlone(t *testing.T) {
	// The bottom rung of the fallback ladder — an instrumental with no video
	// and no lyrics — is still a karaoke song.
	if (Artifacts{}).Playable() {
		t.Error("empty artifacts must not be playable")
	}
	if !(Artifacts{Instrumental: "/data/x/instrumental.wav"}).Playable() {
		t.Error("an instrumental alone is enough to sing to")
	}
	if !(Artifacts{Video: "/data/x/karaoke.mp4"}).Playable() {
		t.Error("a rendered video alone is playable")
	}
}

func TestStatusActiveSelectsTheQueue(t *testing.T) {
	active := []Status{StatusQueued, StatusProcessing, StatusReady, StatusPlaying}
	for _, s := range active {
		if !s.Active() {
			t.Errorf("%q belongs on the queue", s)
		}
	}
	for _, s := range []Status{StatusCompleted, StatusFailed} {
		if s.Active() {
			t.Errorf("%q has left the queue", s)
		}
	}
}

func TestStatusValidRejectsUnknownStates(t *testing.T) {
	if Status("singing").Valid() {
		t.Error("unknown statuses must be rejected at the boundary, not stored")
	}
	if !StatusReady.Valid() {
		t.Error("StatusReady must validate")
	}
}

func TestRoleValidRejectsUnknownRoles(t *testing.T) {
	if Role("admin").Valid() {
		t.Error("there are only two roles; anything else is a bug or an attack")
	}
	if !RoleHost.Valid() || !RoleGuest.Valid() {
		t.Error("both real roles must validate")
	}
}
