# Claude Code promo film starter

A small, free starter for rendering an Apple-style promo clip of your app in code. A 3D phone spins in from a black background, lands showing your app screenshot, and a title card fades in above it. The output is a 7-second vertical video (1080 x 1920, 30 fps, H.264) ready for Reels, Shorts or a launch post.

Everything is code: three.js draws the scene in headless Chromium, Playwright steps through the frames one at a time, and ffmpeg encodes them. No video editor, no AI video model. Your screenshot is shown as it is, never redrawn.

![Preview of the rendered clip](docs/preview.gif)

The GIF above is a downscaled copy of the clip this repo renders unchanged. The full-size file is [docs/sample.mp4](docs/sample.mp4). Quillby, the app on the phone, is fictional.

## What it is (and is not)

- One shot, about 7 seconds: the phone flies in spinning, settles at a three-quarter angle and drifts slowly while the camera pushes in.
- One screenshot and one title card (two lines, with one word in your accent colour).
- One config file, `film.config.js`, for the app name, colours, title text, screenshot path and length.
- Deterministic: every frame is a pure function of its frame number, so the same input gives the same video on every run.

It is deliberately small. There is no soundtrack, no multi-scene timeline, no screen swaps, no motion blur and no UI effects. See [Want the full 30-second film?](#want-the-full-30-second-film) if you need those.

## Requirements

- Node.js 20 or newer (tested with Node 24).
- ffmpeg with libx264 on your PATH. Check with `ffmpeg -encoders | grep libx264`. Or point `FFMPEG` at a binary.
- Chromium for Playwright, installed with:

  ```bash
  npx playwright-core install chromium
  ```

  On a fresh Linux server you may also need the system libraries: `npx playwright-core install --with-deps chromium`.

No GPU is needed. Rendering uses SwiftShader (software WebGL), which is slow but gives the same image on every machine.

## Quick start

```bash
git clone https://github.com/subimpact/claude-code-promo-film-starter.git
cd claude-code-promo-film-starter
npm install
npx playwright-core install chromium
npm run render
```

The clip is written to `out/film.mp4`.

Other commands:

| Command | Output |
|---|---|
| `npm run render` | `out/film.mp4`, every frame at full size |
| `npm run still -- 120` | `out/still-0120.png`, one frame, handy for checking framing |
| `node scripts/render.mjs --scale 0.5 --out out/half.mp4` | a half-size clip, quicker to check |
| `npm run gif` | `out/preview.gif` from `out/film.mp4` (360 px wide, 12 fps) |

## Render time

Measured on this repo's own build machine: a cloud VPS with 6 virtual CPU cores (AMD EPYC, 2.0 GHz class), 11 GB RAM and no GPU, with other services running on it. `npm run render` for the 210-frame clip took 56 and 65 seconds of rendering and encoding over two runs (59 and 68 seconds in total including starting Chromium). Both runs produced byte-identical files. A desktop or laptop will usually differ, so treat this as a rough guide only.

## Use your own screenshot

1. Take a portrait screenshot of your app. 1170 x 2532 (an iPhone at 3x) works well; any phone-shaped image between roughly 1.6 and 2.4 times taller than it is wide is accepted, and the phone's display takes its shape from the image.
2. Put it in `assets/screens/`, for example `assets/screens/my-app.png`.
3. Edit `film.config.js`:

   ```js
   export default {
     name: 'My App',
     colours: { accent: '#3B82F6', title: '#FFFFFF', subtitle: '#8E8E93', frame: '#B9B5AE', background: '#000000' },
     title: { line1: 'Meet *{name}*.', line2: 'Your one-line pitch goes here.' },
     screenshot: 'assets/screens/my-app.png',
     seconds: 7,
   };
   ```

   Wrap one word in `*asterisks*` to draw it in the accent colour. `{name}` is replaced by `name`. Long lines shrink to fit the frame.
4. Check one frame with `npm run still -- 120`, then run `npm run render`.

## Adapt it with Claude Code

The project is small enough for a coding agent to read in one go. Open the folder in Claude Code (or another coding agent) and ask for changes in plain language. Three prompts that work well as a starting point:

> Read film.config.js, src/timeline.js and src/scene.js. Use assets/screens/my-app.png as the screenshot, set the name to "My App", and take the accent colour from the primary colour in my app's CSS at ../my-app/src/styles.css. Render a still at frame 120 and show it to me before rendering the full clip.

> Make the clip 9 seconds long. After the phone lands, add a slow camera orbit of about 15 degrees from left to right. Keep everything a pure function of the frame number, then render stills at frames 60, 150 and 260 so I can check the framing.

> Make a square 1080 x 1080 version for a feed post. Change the output size, keep the title above the phone, pull the camera back until the whole phone fits with some margin, and write the result to out/film-square.mp4.

Ask the agent to render a still and look at it before every full render. It saves time.

## How it works

- `film.config.js`: your inputs.
- `src/timeline.js`: all timing. The phone's spin, rise and tilt, the camera distance, the title entrance and the fades, each as a function of the frame number.
- `src/scene.js`: the three.js scene. A procedural phone (metal frame, glass, camera bump, buttons) lit by an environment map made of light strips, your screenshot on the display as a texture, and the title drawn on a 2D canvas on top.
- `scripts/render.mjs`: starts a tiny local web server and headless Chromium, renders each frame to PNG and pipes it straight into ffmpeg, so no frame files are written to disk.

## Want the full 30-second film?

This starter is cut down from the **Code-Rendered Product Film Kit**, a paid kit by subimpact network. The kit's template renders a 30-second vertical film (1080 x 1920, 30 fps, with sound) and adds:

- A hero reveal and four feature shots, five screens in total, with spins, flips and turn-aways that hide each screen change, so the film reads as one continuous take.
- A beat-synced timeline: every cut, spin and title lands on the beat, and adding a feature shot re-times everything after it.
- A soundtrack and sound effects synthesised in code, with no stock music.
- Motion blur on the fast moves, made by averaging subframes.
- UI effects drawn over your real screenshots: pulsing glow outlines, wipe reveals, row sweeps and row reveals.
- Camera move presets, a fan of three phones and a logo end plate.
- A screen-capture script that photographs your app's pages and reads the highlight areas from the page itself, plus a doctor script and 8 acceptance checks.
- A 24-page PDF guide covering how the pipeline works, adapting the film for your app, render times we measured and the pitfalls we hit.
- 12 copy-paste prompts for Claude Code and a brief template for your coding agent.
- The sample film the template renders unchanged.

Get it on Gumroad: https://subimpact.gumroad.com/l/code-rendered-product-film-kit

Launch offer: code LAUNCH40 takes 40% off for the first 20 buyers: https://subimpact.gumroad.com/l/code-rendered-product-film-kit/LAUNCH40

## Licence

The code in this repo is released under the MIT licence, see [LICENSE](LICENSE). Copyright subimpact network.

Third-party parts keep their own licences:

- Inter Display fonts in `assets/fonts/`: SIL Open Font License 1.1, full text in `assets/fonts/LICENSE.txt`.
- three.js (MIT) and playwright-core (Apache 2.0) are installed by `npm install` and are not included in this repo.
- Chromium is downloaded by Playwright and ffmpeg comes from your system; their own licences apply.

The Quillby screenshot is a placeholder for a fictional app. Replace it before you publish a clip.

Not affiliated with or endorsed by Anthropic or Apple.
