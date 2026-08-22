package config

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestDataDirRelocatesTheWholeTree(t *testing.T) {
	// The host must be able to keep a large music library on an external
	// drive, so every path derives from one setting.
	external := "/Volumes/BigDrive/karaoke"
	c, err := Load([]string{"--data-dir", external})
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	for name, got := range map[string]string{
		"library":   c.LibraryDir(),
		"uploads":   c.UploadsDir(),
		"downloads": c.DownloadsDir(),
		"output":    c.OutputDir(),
		"temp":      c.TempDir(),
		"database":  c.DatabasePath(),
	} {
		if !strings.HasPrefix(got, external) {
			t.Errorf("%s resolved to %q, which is outside the chosen data dir %q", name, got, external)
		}
	}
}

func TestDataDirIsMadeAbsolute(t *testing.T) {
	// Relative paths would resolve against the process working directory,
	// which differs between a shell launch and a double-clicked app.
	c, err := Load([]string{"--data-dir", "./relative-data"})
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !filepath.IsAbs(c.DataDir) {
		t.Errorf("data dir %q is relative; it must be resolved at startup", c.DataDir)
	}
}

func TestEnvironmentSuppliesDefaults(t *testing.T) {
	t.Setenv("KARAOKIO_DATA_DIR", "/tmp/from-env")
	c, err := Load(nil)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.DataDir != "/tmp/from-env" {
		t.Errorf("expected the environment to supply the data dir, got %q", c.DataDir)
	}
}

func TestFlagsBeatEnvironment(t *testing.T) {
	t.Setenv("KARAOKIO_DATA_DIR", "/tmp/from-env")
	c, err := Load([]string{"--data-dir", "/tmp/from-flag"})
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.DataDir != "/tmp/from-flag" {
		t.Errorf("an explicit flag must win over the environment, got %q", c.DataDir)
	}
}

func TestWorkersDefaultsToBoundedConcurrency(t *testing.T) {
	c, err := Load(nil)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.Workers < 1 {
		t.Errorf("workers must default to at least 1, got %d", c.Workers)
	}
}

func TestWorkersMustBePositive(t *testing.T) {
	// Zero workers would accept songs and never process them — a silent
	// party-night failure worth rejecting at startup.
	if _, err := Load([]string{"--workers", "0"}); err == nil {
		t.Error("expected an error for --workers=0")
	}
}
