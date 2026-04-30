# LuminaDiary — Code Standards

## File Naming

- **kebab-case** for all source files: `timeline-card.tsx`, `use-photos.ts`, `vision_service.py`.
- One default export per component file.
- Test file mirrors source: `timeline-card.test.tsx` next to source.

## TypeScript (Mobile)

- `strict: true` in tsconfig.
- No `any` outside short-lived type guards.
- Prefer `type` for unions / aliases, `interface` only for class-style extension.
- React components: typed props via `type Props = { ... }`; export both component and `Props` if reused.
- Path alias: `@/*` → `src/*`.

## Components

- Keep file ≤ **200 lines**. Split into sub-components or hooks at threshold.
- Single responsibility — one visual concern per file.
- Use `React.memo` only after observing measurable re-render cost.
- All animations via `react-native-reanimated` v3 hooks (`useSharedValue`, `useAnimatedStyle`); no `Animated` API.
- All async UI states: idle / loading / success / error must be explicitly modeled.

## State

- **Zustand** stores in `src/stores/<domain>-store.ts`.
- Store shape: `state` + `actions` separated; selectors used at call site to avoid over-rendering.
- **React Query** for any data fetched from Supabase or backend; Zustand only for UI state and ephemeral session data.

## Styling

- StyleSheet.create per file at bottom; no inline objects in JSX (perf + readability).
- Color / spacing / radius values **must come from tokens** (`@/theme`). Never literal hex in component.
- Prefer flexbox; avoid absolute positioning except for overlays.

## Python (Backend)

- Python 3.12, `ruff` for lint + format, `mypy --strict` on `app/`.
- Type-hint every function. Pydantic v2 for schemas.
- Async-first: use `httpx.AsyncClient`, async DB calls; never block the event loop.
- One responsibility per module; no god files.
- Service functions are pure where possible; side effects isolated to `*_client.py`.

## Errors

- Mobile: render typed errors; never swallow. Toast for transient, full screen for fatal auth failures.
- Backend: raise typed `HTTPException`s with helpful detail; do not leak internal traces in 5xx responses.

## Testing

- **Mobile**: Jest + `@testing-library/react-native`. Hooks tested in isolation. No snapshot-only tests.
- **Backend**: pytest + `httpx.AsyncClient`. Run against test Supabase project (or stub via service abstraction).
- Real data — **no mocks for the system under test**. External AI / Supabase clients can be faked at the boundary.
- Coverage target: 70% lines, 80% on services / utils. Don't game the metric.

## Commits

- Conventional Commits: `feat: `, `fix: `, `chore: `, `docs: `, `refactor: `, `test: `.
- Imperative, ≤72 chars subject.
- Bodies optional; explain why, not what.
- No AI references / co-author tags.

## Linting

- Mobile: ESLint + `@typescript-eslint`, prettier, `eslint-plugin-react-native`.
- Backend: ruff (E,F,I,UP,N,B,S) + mypy strict.
- Pre-commit local hook (lefthook or husky): lint + typecheck on staged files.

## Secrets

- All keys via `.env` (mobile reads `EXPO_PUBLIC_*` for non-sensitive; sensitive only on backend).
- Never commit `.env`; ship `.env.example` placeholders only.
- Rotate the service-role key before any public release.

## Performance Budgets

- Cold start to first frame on iPhone 12: < 2.0s.
- Today tab scroll: 60fps with 50 photos loaded.
- Photo upload feedback within 200ms (optimistic insert + async S3 upload).
- AI commentary p95 latency target: < 3.5s for Gemini Flash.
