// gif.mjs: turns out/film.mp4 into a small looping GIF for a README or a social post.
//   npm run gif                          -> out/preview.gif (360 px wide, 12 fps)
//   npm run gif -- 480 15                -> 480 px wide, 15 fps
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [width = '360', fps = '12'] = process.argv.slice(2);
if (!fs.existsSync('out/film.mp4')) { console.error('out/film.mp4 not found; run "npm run render" first.'); process.exit(1); }
const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', 'out/film.mp4', '-vf', vf, '-loop', '0', 'out/preview.gif'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
console.log(`wrote out/preview.gif (${(fs.statSync('out/preview.gif').size / 1024 / 1024).toFixed(2)} MB)`);
