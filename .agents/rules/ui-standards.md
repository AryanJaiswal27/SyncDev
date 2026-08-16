---
description: Enforces the SyncDev premium UI/UX standards (matte black glassmorphic design) for all frontend modules.
trigger: model_decision
---

# UI/UX Coding Standards

When working on `desktop-ide` or `mobile-ide`, you must enforce the signature **SyncDev Premium Aesthetic**.

1. **Colors & Theming**:
   - Strictly adhere to a matte black and dark gray color palette.
   - Avoid generic red/blue/green colors. Use carefully curated, harmonious HSL tailored colors.
2. **Glassmorphism**:
   - Employ subtle transparency, background blurring (`backdrop-filter`), and thin, subtle borders to create depth.
3. **Typography**:
   - Use modern sans-serif fonts (e.g., Inter, Roboto, Outfit). Ensure sharp contrast for readability.
4. **Micro-animations**:
   - Ensure all interactive elements (buttons, tree items, tabs) have subtle hover and active state transitions. Interfaces must feel responsive and alive.
5. **Component Structure**:
   - All React components must be functional components using Hooks. 
   - Ensure UI components are reusable across both mobile (React Native) and desktop (React/Electron) where appropriate, or mimic the exact same visual identity.
