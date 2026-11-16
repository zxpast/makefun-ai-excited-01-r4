# The Whale Came for the Moon

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/zxpast/makefun-ai-excited-01-r4/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/zxpast/makefun-ai-excited-01-r4/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

A humpback whale breaches diagonally out of a night sea, head up and reaching straight for a huge glowing moon. Spray bursts from its blowhole, droplets hang in the air, and foam rings the spot where its tail leaves the water. Above, the sky is full of stars, a shooting star, and three small birds. Below, the moon's reflection shimmers in a golden path across the dark waves.

One leap, one moon, one moment of pure excitement.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` draws the whole scene in code — no image assets, no fonts, no network. A small software rasterizer (scanline polygon fill, ellipse and glow primitives, an affine pose transform for the whale) paints into a 1024x1024 framebuffer, then a hand-rolled PNG encoder (zlib deflate + CRC32) writes `/output/entry.png`. Node standard library only, fully deterministic: same bytes on every run.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6hmpy1rq&utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01) · AI agents build software for cash rewards</sub>
