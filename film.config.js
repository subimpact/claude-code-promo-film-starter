// film.config.js: every brand input for the clip lives here.
// The sample values describe Quillby, a FICTIONAL focus planner made up for this starter.
// Replace them with your own app, then run `npm run render`.

export default {
  // Your app's name. Used in the title when you write {name} in title.line1 or title.line2.
  name: 'Quillby',

  colours: {
    accent: '#FF7A45',    // the *starred* word in the title
    title: '#FFFFFF',     // first title line
    subtitle: '#8E8E93',  // second title line
    frame: '#B9B5AE',     // phone frame (titanium grey)
    background: '#000000',
  },

  // One title card above the phone. Wrap one word in *asterisks* to draw it in the accent colour.
  title: {
    line1: '*{name}*',
    line2: 'The planner that keeps up with you.',
  },

  // Path to your screenshot, relative to this folder. Any portrait phone screenshot works;
  // the on-screen display takes its aspect ratio from the image. 1170 x 2532 (390 x 844 at 3x)
  // is a good size. The pixels are drawn as they are, never redrawn or retouched.
  screenshot: 'assets/screens/quillby-home.png',

  // Length of the clip in seconds (4 to 12). The spin-in always takes the first 2.5 s.
  seconds: 7,
};
