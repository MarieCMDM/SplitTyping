# SplitTyping

SplitTyping is a calm, accuracy-first typing trainer for building reliable touch-typing muscle memory. It presents practice as a focused, code-inspired workspace with progressive lessons, accuracy and speed metrics, keyboard visualization, and persistent local progress.

## Project Aim

The project aims to make touch typing deliberate and approachable. Lessons introduce keys progressively, reward accurate repetition, and provide useful feedback without turning practice into a distraction-heavy game. The trainer currently includes Foundations, English, Italian, and code-oriented exercises, with support for standard and Sofle keyboard profiles.

SplitTyping is also intended to become a practical companion for people learning or configuring split keyboards. The on-screen map, logical layout, lesson content, and physical keyboard should stay aligned throughout the learning process.

## Installation

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite in your browser. To validate or preview a production build, run:

```bash
npm test
npm run build
npm run preview
```

## Future Goals

- Expand the curriculum with more progressive lessons, languages, and programming patterns.
- Improve split-keyboard support and make practice adaptable to more physical layouts.
- Discover compatible keyboard layouts automatically when the browser and device expose enough information.
- Add editable keyboard presets so users can describe their own hardware and mappings.
- Keep the visual keyboard map synchronized with the selected course and active layout.
- Integrate with common keyboard firmware and configuration tools such as QMK, ZMK, VIA, and Vial.

## TODO

- Add broader lesson coverage and more detailed progress analytics.
- Define a robust layout and preset model for custom split keyboards.
- Investigate safe browser-based integration points for firmware and configurator tools.
- Test keyboard detection, mappings, and visual layouts across more devices and browsers.
- Improve accessibility, keyboard navigation, and practice recovery flows.

## Contributing

Contributions are welcome, especially lesson ideas, layout definitions, device testing, accessibility improvements, and firmware-tool integration research. The maintainer cannot own or test every keyboard, so reports and pull requests should include the hardware, firmware, logical layout, browser, and reproduction steps whenever relevant.

Before submitting a change, run `npm test` and `npm run build`. Keep changes focused and include screenshots for visual updates.
