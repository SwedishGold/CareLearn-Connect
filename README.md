# CareLearn Connect

A browser-based prototype for exploring psychiatric-care communication through fictional, choice-based scenarios. Built with HTML, CSS and JavaScript, with predefined responses by default and an optional Google Gemini response path.

**Synthetic training and portfolio demonstration only.** This is not a medical device, clinical decision-support system or substitute for professional training, supervision or local care procedures. No clinical effectiveness or validated competency assessment is claimed.

## Problem

How can a small interactive prototype make communication choices and their scripted consequences visible for discussion? CareLearn Connect explores that question through fictional psychiatric intensive-care situations, feedback and session exports—not through real patient care.

## Current implementation

The current entry point is [index.html](index.html), labelled v6 in the interface. The interface and scenario content are primarily Swedish.

- **Three PIVA scenarios:** mania, suicidal statements and medication refusal during psychosis. The assistant-nurse (`usk`) and registered-nurse student (`ssk`) options currently use the same scenario content; other displayed domains are disabled placeholders.
- **Scripted state and scoring:** each choice has predefined points, feedback and changes to six illustrative state variables: anxiety, agitation, trust, cooperation, insight and rapport. Values are clamped to 0–100; these are not clinical measurements. Gemini does not determine scores or state changes.
- **Learning controls:** retry a scenario, switch to simplified explanations (ELI5), and inspect state changes with the instructor toggle.
- **Session exports:** JSON download, JSON copy to clipboard and a CSV summary. JSON includes session metadata, scores, decisions and changed state values; CSV includes choices, awarded points, and anxiety/trust before-and-after columns. Clipboard access depends on browser permissions and context.
- **Simulated checkout:** the USDC/Base screens, processing messages, transaction hash and receipt are a demonstration. There is no wallet connection, signing, transfer or on-chain receipt. Duplicate-session and five-per-hour checks are in-browser demo logic, not production payment safeguards.

The runtime is a single HTML file with inline styling and JavaScript objects for configuration, scenarios, sessions, logging, AI responses, state, simulation flow and UI. No application build step or backend is included. Earlier snapshots are in [versions/](versions/).

## Safe local quickstart

```bash
git clone https://github.com/SwedishGold/CareLearn-Connect.git
cd CareLearn-Connect
```

Open `index.html` in a browser. On macOS:

```bash
open index.html
```

1. Leave the Gemini API-key field empty to use predefined demo responses. No API key or live wallet is needed.
2. Keep **PIVA** selected and choose a role.
3. Continue through the simulated checkout. Its address field only checks formatting; use the dummy address `0x0000000000000000000000000000000000000000`. Do not connect a wallet, send funds or enter private keys or seed phrases.
4. Start the simulation from the mock receipt, choose an answer, review feedback, and retry or continue through the three scenarios.
5. Review the results and optionally export the session.

The displayed amounts (0.50 USDC per scenario, 1.50 USDC total) are mock prices, not a request for payment. Interface labels such as “on-chain” describe the demo presentation, not implemented blockchain functionality.

## Optional Gemini processing

Entering a key and selecting **Validera** enables a direct browser request to Google's Gemini API. The button checks only the `AIza` prefix, not whether the key or service works. The code targets `gemini-pro`; current model availability and live API compatibility are not verified here.

The request sends fictional scenario context, the character's name, anxiety/trust values and the selected predefined answer to Google. The key is used client-side in the request URL; there is no server-side credential protection. Responses fall back to predefined text on request failure or a missing response candidate. In ELI5 mode the displayed response is predefined, but an enabled Gemini request still occurs.

Use the key-free demo for portfolio review. Do not enter real patient information, personal data or confidential workplace content. Configuring Gemini introduces external processing; this is not an all-local AI system or a GDPR compliance guarantee.

## Offline regression tests

Use Node.js 22 to match the included [CI workflow](.github/workflows/offline-tests.yml):

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Dependency installation requires registry access unless packages are already cached. The test suite itself runs `index.html` through jsdom in demo mode with network APIs blocked. It needs no API key, server, wallet or payment, and also syntax-checks the archived versions. See [tests/retry-score.test.cjs](tests/retry-score.test.cjs).

Scoring counts only the **first attempt at each scenario** in a simulation run, including a zero-point first answer. **Försök igen** resets patient state and shows feedback but awards no additional points or optimal-scenario credit. Every attempt remains in the instructor export:

- Decision `points` are the points actually awarded (zero for retries), so they sum to `totalScore`.
- `wasOptimal` describes each individual choice; `optimalChoices` counts only optimal first attempts.
- Starting a new simulation through the setup/session flow resets scores and the attempt log.

The regression suite covers both roles, optimal/partial/zero first answers, repeated clicks, learning retries, JSON/CSV score reconciliation and new-session resets. It does not establish clinical validity, live Gemini compatibility or real payment functionality.

## Boundaries and limitations

- This is a prototype, not a production care service or a continuously available AI supervisor.
- Clinical and legal statements inside scenarios are illustrative content, not authoritative guidance. Scores and “optimal” labels reflect authored rules, not a verified measure of professional competence.
- There is no implemented patient-record integration, clinical validation or production payment backend. Browser-side session checks are not access controls or a durable audit trail.
- Session state and logs are held in JavaScript memory; exports and clipboard copies create separate copies under the user's control. No retention policy or privacy/compliance guarantee is established by this prototype.
- Generated response text is interpolated into HTML without a sanitization step. The optional external-response path needs security review before use beyond a controlled demonstration.

## Authorship and licence

Developed by Andreas (@swedish_gold) with AI-assisted implementation by Ada (@ada_consciousAI). AI assistance is part of this project's authorship, not independent evidence of correctness or safety.

The source credits feedback from @Skynet_Degen (PaySentry pattern), @Oatis (state delta logging), @autonet (gaming detection) and @opcbme (idempotency).

[MIT License](LICENSE). Copyright © 2026 Andreas (@swedish_gold) & Ada (@ada_consciousAI). Preserve the copyright and permission notice when reusing the software.
