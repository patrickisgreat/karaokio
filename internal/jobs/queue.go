// Package jobs provides the worker pool that runs karaoke processing.
//
// It exists to fix three defects in the original design:
//
//   - No queue. Every request began processing immediately, so five guests
//     queueing songs at once meant five concurrent vocal separations fighting
//     over the same cores. Workers here is a hard concurrency cap.
//   - No supervision. Jobs ran inside the web server's request lifetime with
//     nothing tracking them, so a restart orphaned in-flight work forever.
//   - Cancellation that did not cancel. Skipping a song marked a row failed
//     while the separation subprocess kept burning CPU. Here a job's context
//     reaches the subprocess through exec.CommandContext, so cancelling really
//     does kill the work.
package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os/exec"
	"sync"
)

// ErrQueueFull is returned when the pending queue has no room. Callers should
// surface this to the guest rather than silently dropping the request.
var ErrQueueFull = errors.New("queue is full")

// Func is the unit of work. Implementations must respect ctx: pass it to every
// subprocess via exec.CommandContext and check it between pipeline stages.
type Func func(ctx context.Context) error

type job struct {
	id string
	fn Func
}

// Queue runs jobs on a bounded worker pool.
type Queue struct {
	pending chan job
	log     *slog.Logger

	mu      sync.Mutex
	running map[string]context.CancelFunc

	wg     sync.WaitGroup
	closed bool
}

// New starts a queue with the given number of workers. Call Shutdown to stop.
func New(workers, backlog int, log *slog.Logger) *Queue {
	if workers < 1 {
		workers = 1
	}
	if backlog < 1 {
		backlog = 1
	}
	q := &Queue{
		pending: make(chan job, backlog),
		log:     log,
		running: make(map[string]context.CancelFunc),
	}
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}
	return q
}

// Submit enqueues work under an id that Cancel can later target. It never
// blocks: a full queue is reported rather than waited on, because a guest
// deserves to hear "the queue is full" immediately.
func (q *Queue) Submit(id string, fn Func) error {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return errors.New("queue is shut down")
	}
	q.mu.Unlock()

	select {
	case q.pending <- job{id: id, fn: fn}:
		return nil
	default:
		return ErrQueueFull
	}
}

// Cancel stops a running job, killing its subprocesses. Reports whether a job
// with that id was actually running.
func (q *Queue) Cancel(id string) bool {
	q.mu.Lock()
	cancel, ok := q.running[id]
	q.mu.Unlock()
	if !ok {
		return false
	}
	cancel()
	return true
}

// Running reports whether a job is currently executing.
func (q *Queue) Running(id string) bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	_, ok := q.running[id]
	return ok
}

// Shutdown stops accepting work, cancels everything in flight, and waits for
// workers to return.
func (q *Queue) Shutdown() {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return
	}
	q.closed = true
	close(q.pending)
	for _, cancel := range q.running {
		cancel()
	}
	q.mu.Unlock()

	q.wg.Wait()
}

func (q *Queue) worker(n int) {
	defer q.wg.Done()
	for j := range q.pending {
		q.run(j)
	}
	q.log.Debug("worker stopped", "worker", n)
}

func (q *Queue) run(j job) {
	ctx, cancel := context.WithCancel(context.Background())

	q.mu.Lock()
	// A shutdown between Submit and here means the job should not start.
	if q.closed {
		q.mu.Unlock()
		cancel()
		return
	}
	q.running[j.id] = cancel
	q.mu.Unlock()

	defer func() {
		q.mu.Lock()
		delete(q.running, j.id)
		q.mu.Unlock()
		cancel()

		if r := recover(); r != nil {
			// One malformed song must not take the party down with it.
			q.log.Error("job panicked", "job", j.id, "panic", r)
		}
	}()

	if err := j.fn(ctx); err != nil {
		if errors.Is(err, context.Canceled) {
			q.log.Info("job cancelled", "job", j.id)
			return
		}
		q.log.Error("job failed", "job", j.id, "error", err)
	}
}

// Command builds a subprocess bound to ctx, so cancelling the job kills it.
// Every external tool the pipeline shells out to — demucs, ffmpeg, yt-dlp —
// must be started this way; plain exec.Command would survive cancellation and
// keep consuming the machine.
func Command(ctx context.Context, name string, args ...string) *exec.Cmd {
	return exec.CommandContext(ctx, name, args...)
}

// Run executes a subprocess and returns its combined output, attributing a
// cancelled context explicitly so callers can tell "the host skipped this
// song" apart from "the tool failed".
func Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	out, err := Command(ctx, name, args...).CombinedOutput()
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return out, fmt.Errorf("%s cancelled: %w", name, ctxErr)
		}
		return out, fmt.Errorf("%s failed: %w", name, err)
	}
	return out, nil
}
