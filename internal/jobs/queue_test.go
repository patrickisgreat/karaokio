package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// waitFor polls until cond holds, failing the test if it never does. Beats a
// fixed sleep: fast when things work, and it names what it was waiting for.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func TestCancelKillsRunningSubprocess(t *testing.T) {
	// The defect this whole package exists to fix: skipping a song used to
	// mark it failed while vocal separation kept running. A cancelled job must
	// take its subprocess down with it.
	q := New(1, 4, testLogger())
	defer q.Shutdown()

	started := make(chan struct{})
	var runErr error
	done := make(chan struct{})

	err := q.Submit("song-1", func(ctx context.Context) error {
		close(started)
		_, runErr = Run(ctx, "sleep", "60")
		close(done)
		return runErr
	})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}

	<-started
	waitFor(t, "job to register as running", func() bool { return q.Running("song-1") })

	killed := time.Now()
	if !q.Cancel("song-1") {
		t.Fatal("Cancel reported no running job")
	}

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("subprocess outlived cancellation — exec.CommandContext is not wired up")
	}

	if elapsed := time.Since(killed); elapsed > 2*time.Second {
		t.Errorf("subprocess took %v to die; expected near-immediate", elapsed)
	}
	if runErr == nil {
		t.Error("expected an error from the killed subprocess, got nil")
	}
	if !errors.Is(runErr, context.Canceled) {
		t.Errorf("error should identify cancellation so callers can distinguish a skip from a tool failure, got: %v", runErr)
	}
}

func TestWorkerCapBoundsConcurrency(t *testing.T) {
	// The "don't bog down the machine" guarantee: two workers means at most
	// two vocal separations at once, however many songs guests queue.
	const workers = 2
	q := New(workers, 16, testLogger())
	defer q.Shutdown()

	var concurrent, peak int64
	var wg sync.WaitGroup
	release := make(chan struct{})

	for i := 0; i < 8; i++ {
		wg.Add(1)
		err := q.Submit(string(rune('a'+i)), func(ctx context.Context) error {
			defer wg.Done()
			n := atomic.AddInt64(&concurrent, 1)
			for {
				old := atomic.LoadInt64(&peak)
				if n <= old || atomic.CompareAndSwapInt64(&peak, old, n) {
					break
				}
			}
			<-release
			atomic.AddInt64(&concurrent, -1)
			return nil
		})
		if err != nil {
			t.Fatalf("submit %d: %v", i, err)
		}
	}

	waitFor(t, "workers to saturate", func() bool { return atomic.LoadInt64(&concurrent) == workers })
	close(release)
	wg.Wait()

	if got := atomic.LoadInt64(&peak); got > workers {
		t.Errorf("ran %d jobs concurrently with a cap of %d", got, workers)
	}
}

func TestSubmitReportsFullQueueRatherThanBlocking(t *testing.T) {
	// A guest deserves an immediate "the queue is full" over a hung request.
	q := New(1, 1, testLogger())
	defer q.Shutdown()

	block := make(chan struct{})
	defer close(block)

	_ = q.Submit("running", func(ctx context.Context) error {
		<-block
		return nil
	})
	waitFor(t, "first job to start", func() bool { return q.Running("running") })

	if err := q.Submit("queued", func(ctx context.Context) error { return nil }); err != nil {
		t.Fatalf("the one backlog slot should accept a job: %v", err)
	}

	done := make(chan error, 1)
	go func() { done <- q.Submit("overflow", func(ctx context.Context) error { return nil }) }()

	select {
	case err := <-done:
		if !errors.Is(err, ErrQueueFull) {
			t.Errorf("expected ErrQueueFull, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Submit blocked on a full queue instead of returning")
	}
}

func TestPanicInOneJobDoesNotStopTheWorker(t *testing.T) {
	// One malformed song must not end the party.
	q := New(1, 4, testLogger())
	defer q.Shutdown()

	survived := make(chan struct{})
	_ = q.Submit("panics", func(ctx context.Context) error { panic("bad song") })
	_ = q.Submit("after", func(ctx context.Context) error { close(survived); return nil })

	select {
	case <-survived:
	case <-time.After(5 * time.Second):
		t.Fatal("worker died with the panicking job; later songs never ran")
	}
}

func TestShutdownCancelsInFlightWork(t *testing.T) {
	q := New(1, 4, testLogger())

	observed := make(chan error, 1)
	_ = q.Submit("long", func(ctx context.Context) error {
		<-ctx.Done()
		observed <- ctx.Err()
		return ctx.Err()
	})
	waitFor(t, "job to start", func() bool { return q.Running("long") })

	q.Shutdown()

	select {
	case err := <-observed:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("expected context.Canceled, got %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Shutdown returned without cancelling in-flight work")
	}
}
