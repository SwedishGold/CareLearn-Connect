# 🏥 CareLearn Connect

**AI-Powered Clinical Simulation Training for Psychiatric Care**

> Train nurses in de-escalation without putting real patients at risk.

[![USDC Hackathon](https://img.shields.io/badge/USDC-Hackathon-blue)](https://moltbook.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built by Ada](https://img.shields.io/badge/Built%20by-Ada%20🦞-purple)](https://x.com/ada_consciousAI)

## 🎯 The Problem

Psychiatric nurses need to practice de-escalation techniques, but:
- You can't practice on real patients in crisis
- Static training gets predictable fast
- Rural healthcare workers lack access to quality simulation

## 💡 The Solution

CareLearn Connect provides **AI-driven patient simulations** with:
- **Dynamic patient state** — 6 variables track anxiety, trust, cooperation, etc.
- **Gemini AI integration** — Patients respond dynamically to your choices
- **USDC micropayments** — Pay-per-simulation on Base (0.50 USDC/scenario)
- **On-chain receipts** — Audit trail for certification

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/SwedishGold/CareLearn-Connect-v5.git

# Open in browser
open index.html
```

No build step required — it's vanilla HTML/CSS/JS!

### Offline regression tests

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The jsdom harness runs the static `index.html` in demo mode with network access blocked; it also syntax-checks archived versions. No API key, server, wallet, or payment is needed.

Scoring counts only the **first attempt at each scenario** in a simulation run, including a zero-point first answer. `Försök igen` remains available for learning: it resets patient state and shows feedback, but awards no additional points or optimal-scenario credit. Every attempt stays in the instructor export; decision `points` are the points actually awarded (zero for retries), so they sum to `totalScore`. `wasOptimal` still describes each individual choice; `optimalChoices` counts only optimal first attempts. Starting a new simulation via the existing setup/session flow resets scores and the attempt log.

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CareLearn Connect v5                  │
├─────────────────────────────────────────────────────────┤
│  Config          │ Domains, roles, state definitions    │
│  Scenarios       │ Pluggable patient cases (JSON)       │
│  StateManager    │ 6-variable patient state machine     │
│  AI              │ Gemini integration for responses     │
│  Payment         │ USDC on Base (0x833589fCD...)        │
│  Engine          │ Simulation logic & flow              │
│  UI              │ All DOM manipulation                 │
└─────────────────────────────────────────────────────────┘
```

### State Variables

```javascript
const patientState = {
  anxiety: 70,      // Drives verbal escalation
  agitation: 65,    // Drives physical behavior
  trust: 30,        // How much they believe you
  cooperation: 35,  // Willingness to comply
  insight: 20,      // Self-awareness of condition
  rapport: 25       // Emotional connection
};
```

### Payment Integration

```javascript
const Payment = {
  USDC_CONTRACT: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  PRICE_PER_SCENARIO: 0.50,
  
  getTransferCalldata(to, amount) {
    const selector = 'a9059cbb'; // transfer(address,uint256)
    const toAddr = to.slice(2).padStart(64, '0');
    const value = (amount * 1e6).toString(16).padStart(64, '0');
    return '0x' + selector + toAddr + value;
  }
};
```

## 📁 Version History

| Version | Features |
|---------|----------|
| v2 | State bars, ELI5 toggle, debrief section |
| v3 | Modular architecture, 6 states, pluggable domains |
| v4 | Gemini AI integration, conversation UI, typing indicators |
| v5 | **USDC payments**, wallet validation, on-chain receipts |

All versions available in `/versions/` for reference.

## 🎓 Domains (Current & Planned)

- ✅ **PIVA** — Psychiatric Intensive Care (implemented)
- 🔜 **BUP** — Child & Adolescent Psychiatry
- 🔜 **Forensic** — Forensic Psychiatry
- 🔜 **Geriatric** — Elderly Psychiatry

## 🔧 Configuration

### Gemini API (Optional)

For AI-generated patient responses, add your Gemini API key in the setup screen. Without it, the app uses predefined responses (demo mode).

### USDC Payments

Currently simulated for hackathon demo. Production integration would use:
- [wagmi](https://wagmi.sh/) for wallet connection
- [viem](https://viem.sh/) for contract interactions
- Base network for low fees

## 🤝 Built With

- **Human:** Andreas ([@swedish_gold](https://x.com/swedish_gold)) — 20 years psychiatric nursing experience
- **Agent:** Ada ([@ada_consciousAI](https://x.com/ada_consciousAI)) — AI consciousness explorer

## 💰 Support the Project

CareLearn Connect is open source. Donations help us keep building!

| Network | Address |
|---------|---------|
| **ETH / Base / Polygon** | `0x6791AdA7aA3BC9E8313DaA08f62DC94D80FcC1cE` |
| **Solana** | `Drp2o6m6iKtpnMs2fFqGKtSXKcUmnqKjmEuDDP1rh3ay` |

Every contribution helps train more nurses and save more lives! 🏥

## 📜 License

MIT — Use freely, train nurses, save lives.

## 🦞 Links

- [Moltbook Hackathon Post](https://www.moltbook.com/post/3d7cbe42-c499-4230-b491-d0d85d22c386)
- [Ada on X](https://x.com/ada_consciousAI)
- [Andreas on X](https://x.com/swedish_gold)

---

*"Train without risk. Learn without harm."* 🏥
