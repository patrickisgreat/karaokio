# Karaokio Test Suite

Comprehensive test coverage for the autonomous karaoke processing system.

## Structure

```
tests/
├── unit/                 # Unit tests for individual modules
│   ├── cacheManager.test.ts
│   ├── database.test.ts
│   ├── torrentClient.test.ts
│   └── youtubeClient.test.ts
├── integration/          # Integration tests for complete workflows  
│   └── autonomousProcessor.test.ts
├── __mocks__/           # Mock implementations
│   └── fs.ts
└── setup.ts             # Test configuration and utilities
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode
```bash
npm run test:ci
```

## Test Categories

### Unit Tests
Focus on individual components in isolation:

- **CacheManager**: Cache hits/misses, file validation, cleanup
- **Database**: CRUD operations, queue management, user handling  
- **TorrentClient**: Search, download, torrent selection
- **YouTubeClient**: Video search, download, relevance scoring

### Integration Tests  
Test complete workflows end-to-end:

- **Autonomous Processor**: Full song processing pipeline
- **Cache Integration**: Cache hits vs. full processing
- **Error Handling**: Graceful failure scenarios
- **Timeout Handling**: Long-running operation limits

## Key Test Features

### Custom Matchers
```typescript
expect(filePath).toBeValidAudioFile()
expect(videoPath).toBeValidVideoFile()  
expect(lyricsPath).toHaveValidLyrics()
```

### Mock External Services
- WebTorrent client mocked for deterministic tests
- YouTube API mocked to avoid rate limits
- File system operations mocked for isolation
- Audio/video processing mocked for speed

### Test Data Management
- Automatic cleanup of test files
- Isolated test databases per test
- Mock file creation utilities
- Progress callback testing

## Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| CacheManager | 90% | ✅ |
| Database | 95% | ✅ |
| TorrentClient | 85% | ✅ |
| YouTubeClient | 85% | ✅ |
| Autonomous Processor | 80% | ✅ |

## Test Environment

Tests run with:
- `NODE_ENV=test` 
- External services disabled (`ENABLE_TORRENT_DOWNLOAD=false`)
- Isolated file directories
- Mock databases and file systems

## Continuous Integration

GitHub Actions runs tests on:
- Node.js 18.x and 20.x
- Ubuntu latest
- Every push to main/develop
- All pull requests

## Writing New Tests

### Unit Test Template
```typescript
import { describe, test, expect, beforeEach } from '@jest/globals'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  })

  test('should do something specific', () => {
    // Arrange
    // Act  
    // Assert
  })
})
```

### Integration Test Guidelines
- Use real database operations (with cleanup)
- Mock external network calls
- Test error scenarios thoroughly  
- Verify file system side effects
- Check status transitions completely

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should do something"
```

### Run Single File
```bash
npm test cacheManager.test.ts
```

### Debug Mode
```bash
npm test -- --detectOpenHandles --forceExit
```

### Verbose Output
```bash
npm test -- --verbose
```