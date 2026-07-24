# SplitTyping

SplitTyping is a calm, accuracy-first typing trainer for building reliable touch-typing muscle memory. It presents practice as a focused, code-inspired workspace with progressive lessons, accuracy and speed metrics, keyboard visualization, and persistent local progress.

> **Live demo:** [splittyping.cmdmtech.com](https://splittyping.cmdmtech.com/)
>
> SplitTyping is [open source on GitHub](https://github.com/MarieCMDM/SplitTyping), so you can install it locally or deploy your own instance.

## Workspace

| Setting | Current value |
| --- | --- |
| Keyboard | [Configured keyboard](#splittyping-keyboard) |
| Layout | [Configured layout](#splittyping-layout) |
| Attempts | [Recorded attempts](#splittyping-attempts) |
| Active lesson | [Current lesson](#splittyping-active-lesson) |

### Next Lesson

[Continue with the next available lesson](#splittyping-next-lesson).

### Quick Links

[Open lesson](#splittyping-open-lesson) · [Inspect progress](#splittyping-progress) · [Open settings](#splittyping-settings)

> **Hint — Strange Markdown, huh?** That is because the web app renders this README as its welcome page and enhances the values and links above with the current local workspace state.

## Project Aim

The project aims to make touch typing deliberate and approachable. Lessons introduce keys progressively, reward accurate repetition, and provide useful feedback without turning practice into a distraction-heavy game. The trainer currently includes Foundations, English, Italian, and code-oriented exercises, with presets for common full-size, ISO, and compact normal keyboards.

SplitTyping is also intended to become a practical companion for people learning or configuring keyboards. The on-screen map separates form factor, ANSI/ISO geometry, and US, UK, or Italian legends so lesson content and physical hardware can stay aligned.

## Adding courses

Courses are loaded at runtime from `public/courses/manifest.json` in manifest order. To add a course, place its JSON file beside the existing course files and append its filename to the manifest. No TypeScript registry change is required.

Each course declares its ID, display title, supported keyboard languages, editor format, and ordered lessons. Lessons normally provide `items`, which are joined with spaces, or may provide an exact `text` string. The optional `hint` contains technique coaching; active finger guidance is derived automatically from the selected keyboard layout.

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
