# inkcal preferences

## aesthetic

clean, minimal, "traditional paper" feel that's calm and out of the way. modals/overlays follow the existing pattern in `Search.tsx`, `Settings.tsx`, `Archive.tsx`: small footprint, monospace labels for chrome (headers, hints, footers), muted palette, subtle borders, fade-in only.

avoid:
- decorative icons or emoji
- spring/bouncy animations, sliding panels
- gradients or shadows beyond the existing `border + bg-2` idiom
- accent colors outside theme tokens (`var(--accent)`, `var(--muted)`, etc.)
- anything that feels like a vibe-coded SaaS app

## documentation & code comments

keep tight. only write a comment when removing it would leave a future reader confused. don't:

- restate what the code already says
- describe edge cases the user can intuit
- narrate the change just made. that belongs in the commit message, not the code
- cross-reference other files touched in the same change
- use em dashes

same for README sections, doc files, and PR descriptions: explain what someone needs to know, not everything that changed.

## scope

don't add fallbacks, validation, or feature flags for cases that can't happen. don't refactor adjacent code while fixing a bug. one task at a time.
