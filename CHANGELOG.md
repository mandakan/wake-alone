# Changelog

## [0.3.0](https://github.com/mandakan/wake-alone/compare/v0.2.0...v0.3.0) (2026-06-08)


### Features

* apply design-system refinements to the engine UI ([1c03fa3](https://github.com/mandakan/wake-alone/commit/1c03fa3b4922b651338f41c9d2afb425d7d5cc29))
* cross-episode diversity check (advisory, zero-dep) ([e6f80d6](https://github.com/mandakan/wake-alone/commit/e6f80d673cd73ebe0d97c8677bcbb6a41f3706d7))
* DESCENT degradation enhancements + design-system tokens ([842782a](https://github.com/mandakan/wake-alone/commit/842782abbb3246857dbc0ea1be8b0cd671a095ab))
* **engine:** add favicon + Open Graph card ([4d719e4](https://github.com/mandakan/wake-alone/commit/4d719e40c166a7d6bf6f97e0c8e158119429611a))
* **engine:** add staging-only #lab FX showcase ([f59e926](https://github.com/mandakan/wake-alone/commit/f59e926fb047f33639c8b150054bc561aaff2e0e))
* **engine:** bake in tuned tube-warp defaults (strength 160, curve 3) ([f32435f](https://github.com/mandakan/wake-alone/commit/f32435fc9132dc95df3c82ba005fe0286c5a37fa))
* **engine:** barrel base + terminal/madness pincushion, visible on desktop ([4e28939](https://github.com/mandakan/wake-alone/commit/4e2893970387fed3ca501906bf316594983c6bbb))
* **engine:** collapsible mobile lab panel + device-proportional warp ([33d7c6e](https://github.com/mandakan/wake-alone/commit/33d7c6ed1c03e6380d89fbef0f7bd20c820029dd))
* **engine:** garble room copy in sync with watch flashes ([25fd467](https://github.com/mandakan/wake-alone/commit/25fd467739285ed26aaaacb08d413624638d13cf))
* **engine:** parameterize tube warp + live lab controls ([5762ffd](https://github.com/mandakan/wake-alone/commit/5762ffdaf14ac29d44c4d5aef3b38423f4889c3a))
* **engine:** wire footer version to package.json + discreet source link ([3305a48](https://github.com/mandakan/wake-alone/commit/3305a486498682debecd0770aa3cbeaf4fb40924))
* **episode:** add GRAFT - wake mid-surgery on an auto-surgeon ([3194daf](https://github.com/mandakan/wake-alone/commit/3194dafdfea3fe65570c0f2ce4e480e14175d86f))
* parameterize episode generation with size/punishment dials ([11166ff](https://github.com/mandakan/wake-alone/commit/11166ffbf4d85b585f4fd2e67014e3400be3bf76))
* prose slop linter + solver-backed state-coherence checks ([ac7fbab](https://github.com/mandakan/wake-alone/commit/ac7fbab19022060179b7e973e73c7d542dd06033))
* protagonist profile + role-relative hint calibration (L4) ([7d152ee](https://github.com/mandakan/wake-alone/commit/7d152eec5ee94850fa075edfe16bf3ae493a63af))
* safe tube-warp - bow the scanline overlay only (06), never the text ([8d8ca30](https://github.com/mandakan/wake-alone/commit/8d8ca309fe51785abbf6de891213ce4fcc05e440))
* sanity-aware solvability validation + validator self-tests ([9b996f0](https://github.com/mandakan/wake-alone/commit/9b996f07322cb8b46523b716c8c36544b4974cb1))
* support no-escape (no happy ending) episodes via spec.escape ([487794a](https://github.com/mandakan/wake-alone/commit/487794a36334be96c595ad372feaefbf101d3f86))
* three demo episodes + staging custom domain ([177fc34](https://github.com/mandakan/wake-alone/commit/177fc348feddcfc31e9b696d376b4646498971f1))
* tube-warp v2 - true fixed-viewport CRT bulge (06) ([803d8d2](https://github.com/mandakan/wake-alone/commit/803d8d2c58800b5708a20cf0510589d376f6d152))


### Bug Fixes

* disable tube-warp (06) by default - it clipped text and hid choices ([c062ced](https://github.com/mandakan/wake-alone/commit/c062ced205f0ac3971aea9c22cfe9f8b306cb341))
* **engine:** correct the barrel warp algorithm (was zoom + wrong sign) ([6909cd7](https://github.com/mandakan/wake-alone/commit/6909cd7f4bbff3ac12d827a12376c01618a891c0))
* **engine:** fit the tube warp to the reading column ([e91fcfc](https://github.com/mandakan/wake-alone/commit/e91fcfc4bf463bd7ad9bc828e472214d1248bcaa))
* **engine:** scatter watcher flashes over the room copy ([3e92e22](https://github.com/mandakan/wake-alone/commit/3e92e224ea8511c25f04525aad2bb2c87788622f))
* **episode:** clarify GRAFT's bay gauge line (L6); note reword-legibility trap ([78a5ba5](https://github.com/mandakan/wake-alone/commit/78a5ba51c19c4ff0c359ab4ef98107ed6a15ec38))
* **episode:** clarify GRAFT's low-sanity table line; add craft lesson L6 ([7049222](https://github.com/mandakan/wake-alone/commit/7049222ec1aad03a2aeebb5b5f5532bfe3daba0c))
* **episode:** make GRAFT bay sanity variants self-contained (L7) ([2df32ab](https://github.com/mandakan/wake-alone/commit/2df32ab43bbee52539d253952db99a16294073e6))
* HUD meter on its own full-width row, stable across location names ([18d9501](https://github.com/mandakan/wake-alone/commit/18d9501b930aa713057020e498558c707d1db3e5))
* launch-bay crash, single-dash stories, and a feedback-learning system ([f0f1e1b](https://github.com/mandakan/wake-alone/commit/f0f1e1b419f1363de2cf2054ade0ea0d04e91f6d))
* **lint:** don't count repetition between a node's mutually-exclusive variants ([828609a](https://github.com/mandakan/wake-alone/commit/828609afca517c926ce17f76d0641e1404bf9e27))
* pin the background glow to the viewport; dark overscroll ([eae05b7](https://github.com/mandakan/wake-alone/commit/eae05b7d7e5b9dad845472615e24afe5cc0feeda))
* staging custom domain must be a direct urdr.dev subdomain ([816eabf](https://github.com/mandakan/wake-alone/commit/816eabff577e5270d047bec1c21393a4c1a42026))


### Performance Improvements

* **engine:** stop the tube warp from pegging the GPU/fan ([e9cc00d](https://github.com/mandakan/wake-alone/commit/e9cc00da429fe3a8db0af5a8713ff4c0236f2cd7))

## [0.2.0](https://github.com/mandakan/wake-alone/compare/v0.1.0...v0.2.0) (2026-06-08)


### Features

* production custom domain wake.urdr.dev + README badges ([1efa2aa](https://github.com/mandakan/wake-alone/commit/1efa2aa25f241a9c403d80569f5a33e8c4751c76))


### Bug Fixes

* keep workers.dev URL for staging ([76f86c9](https://github.com/mandakan/wake-alone/commit/76f86c90008fb03e68ccd0dc558e94b9166dc415))
