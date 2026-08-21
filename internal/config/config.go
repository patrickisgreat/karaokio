// Package config resolves runtime settings from flags and environment.
//
// Karaokio is a local-first application: it runs on the machine hosting the
// party, and every piece of state lives under a single data directory that the
// host chooses. Pointing --data-dir at an external drive is the supported way
// to keep a large music library off the system disk.
package config

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

type Config struct {
	// DataDir is the root for every persistent artifact: the database, the
	// music library, downloaded audio, processed output, and the cache.
	DataDir string

	// Addr is the listen address. Defaults to all interfaces so phones on the
	// same wifi can reach the party.
	Addr string

	// Workers bounds concurrent pipeline jobs. Vocal separation saturates a
	// machine, so the default is deliberately conservative: half the cores,
	// minimum one. Raising it does not make any single song finish sooner.
	Workers int

	// HostPIN unlocks host controls. Empty in local development leaves the
	// host gate open; a session is still required.
	HostPIN string

	// PartyCode overrides the generated per-party join code.
	PartyCode string
}

// Subdirectories of DataDir. Library is the host's own music; everything else
// is machine-generated and safe to delete.
func (c Config) LibraryDir() string   { return filepath.Join(c.DataDir, "library") }
func (c Config) UploadsDir() string   { return filepath.Join(c.DataDir, "uploads") }
func (c Config) DownloadsDir() string { return filepath.Join(c.DataDir, "downloads") }
func (c Config) OutputDir() string    { return filepath.Join(c.DataDir, "output") }
func (c Config) TempDir() string      { return filepath.Join(c.DataDir, "temp") }
func (c Config) DatabasePath() string { return filepath.Join(c.DataDir, "karaokio.db") }

// Load parses flags, falling back to environment variables and then defaults.
func Load(args []string) (Config, error) {
	fs := flag.NewFlagSet("karaokio", flag.ContinueOnError)

	defaultWorkers := runtime.NumCPU() / 2
	if defaultWorkers < 1 {
		defaultWorkers = 1
	}

	var c Config
	fs.StringVar(&c.DataDir, "data-dir", envOr("KARAOKIO_DATA_DIR", defaultDataDir()),
		"root directory for the database, music library, and processed output (may be an external drive)")
	fs.StringVar(&c.Addr, "addr", envOr("KARAOKIO_ADDR", ":3000"),
		"listen address")
	fs.IntVar(&c.Workers, "workers", defaultWorkers,
		"maximum concurrent processing jobs")
	fs.StringVar(&c.HostPIN, "host-pin", os.Getenv("KARAOKIO_HOST_PIN"),
		"PIN that grants host controls; empty leaves the host gate open in development")
	fs.StringVar(&c.PartyCode, "party-code", os.Getenv("KARAOKIO_PARTY_CODE"),
		"override the generated party join code")

	if err := fs.Parse(args); err != nil {
		return Config{}, err
	}

	if c.Workers < 1 {
		return Config{}, fmt.Errorf("workers must be at least 1, got %d", c.Workers)
	}

	abs, err := filepath.Abs(c.DataDir)
	if err != nil {
		return Config{}, fmt.Errorf("resolving data dir: %w", err)
	}
	c.DataDir = abs

	return c, nil
}

// EnsureDirs creates the data directory tree. Called once at startup so a
// missing external drive fails loudly here rather than mid-party.
func (c Config) EnsureDirs() error {
	for _, dir := range []string{
		c.DataDir, c.LibraryDir(), c.UploadsDir(),
		c.DownloadsDir(), c.OutputDir(), c.TempDir(),
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("creating %s: %w", dir, err)
		}
	}
	return nil
}

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "./karaokio-data"
	}
	return filepath.Join(home, "karaokio")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
