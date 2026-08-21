# Changelog

## [1.1.3](https://github.com/patrickisgreat/karaokio/compare/v1.1.2...v1.1.3) (2026-08-21)


### Bug Fixes

* image build — keep PyPI primary when installing CPU torch ([f3f5511](https://github.com/patrickisgreat/karaokio/commit/f3f55118cea1b24dd7c0054ed489fa2059d9ad1a))
* keep PyPI as primary index when installing CPU torch ([9e31ba3](https://github.com/patrickisgreat/karaokio/commit/9e31ba3ba92948d7c81d61c52a9357a8316703db))

## [1.1.2](https://github.com/patrickisgreat/karaokio/compare/v1.1.1...v1.1.2) (2026-08-20)


### Bug Fixes

* deploy-app needs registry-host for ECR ([ab3eede](https://github.com/patrickisgreat/karaokio/commit/ab3eedeb87888f56f35f79e5c97fb25977687c6e))
* pass registry-host to docker-build-push for ECR ([0c03559](https://github.com/patrickisgreat/karaokio/commit/0c035599fd1294b94aa027601c6f8c6d14de4f4f))

## [1.1.1](https://github.com/patrickisgreat/karaokio/compare/v1.1.0...v1.1.1) (2026-08-20)


### Bug Fixes

* exempt CHANGELOG.md from the prettier gate ([c97a3bd](https://github.com/patrickisgreat/karaokio/commit/c97a3bd7c5e4b40ba4f8017b7127627886b44100))
* exempt release-please's CHANGELOG.md from the format gate ([de6da7e](https://github.com/patrickisgreat/karaokio/commit/de6da7e62b2bab61c5498db2de116267b1866ecd))

## [1.1.0](https://github.com/patrickisgreat/karaokio/compare/v1.0.0...v1.1.0) (2026-08-20)


### Features

* bootstrap-as-code — the OIDC trust anchor is stack-managed ([b0f97ec](https://github.com/patrickisgreat/karaokio/commit/b0f97ec9f5ac3ea876e72f061299ebdbb58ac702))
* bootstrap-as-code for the OIDC trust anchor ([0ef7fa0](https://github.com/patrickisgreat/karaokio/commit/0ef7fa0b1010a0c59a215827986c945ec421bc51))


### Bug Fixes

* host-pin secret length meets the template's 16-char floor ([dfc0040](https://github.com/patrickisgreat/karaokio/commit/dfc00402734ab99bac5a93a2de34b3b5e430bb4c))

## 1.0.0 (2026-08-20)


### Features

* AWS party-box infrastructure from cloudformation-toolkit ([e76a660](https://github.com/patrickisgreat/karaokio/commit/e76a660e22310fd698a0f047e2e59d532b41ddee))
* enforce party auth across routes and UI ([d01c7de](https://github.com/patrickisgreat/karaokio/commit/d01c7deab6d0461c1e6099a9e7bdfac82ed1a77b))
* generate party-auth secrets in Secrets Manager ([76bfaa7](https://github.com/patrickisgreat/karaokio/commit/76bfaa7d69d4d3062bdc4117e2b6427673df011d))
* party-box container image ([05bb149](https://github.com/patrickisgreat/karaokio/commit/05bb149f6db2500cdd07b8cc0fd18b1b4b83be94))
* party-code auth — the gate the public party box was waiting on ([06e8da6](https://github.com/patrickisgreat/karaokio/commit/06e8da63b7dcab5a4f1cc15cffbdf6c8efb41b82))
* party-code auth core — sessions, join flow, route guard ([c35b11b](https://github.com/patrickisgreat/karaokio/commit/c35b11b25943740785c0495bbcd3a65f78cefc61))
* the last of the scaffolds ([ab24753](https://github.com/patrickisgreat/karaokio/commit/ab247536a55bc9868a0ce4af98aad8975b96ffa5))
* yay UX ([d54f905](https://github.com/patrickisgreat/karaokio/commit/d54f9059494a2544f7bf43f31178b5a8b02e8230))


### Bug Fixes

* clear pipeline race timers and arm torrent timeout immediately ([ee76b2e](https://github.com/patrickisgreat/karaokio/commit/ee76b2e5dc0c142cac847a80f81bacb1ab11d36e))
* remove leftover mock-UI references breaking QueueList at runtime ([9fd7752](https://github.com/patrickisgreat/karaokio/commit/9fd77527e581e045f469274a0d92da36f3494fb1))
* wiring up mock ui to actual API functionality ([068c282](https://github.com/patrickisgreat/karaokio/commit/068c28271023d16b6c4a2cb49ea85e68bd015500))
* wiring up mock ui to actual API functionality ([8bb3f56](https://github.com/patrickisgreat/karaokio/commit/8bb3f56f31330728d3a3cf1c319790a07a502e22))
