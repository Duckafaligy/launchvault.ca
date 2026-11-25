# LaunchVault Steering Guide

## Project Overview
LaunchVault (`www.launchvault.ca`) turns verified founder stories into small, actionable weekly steps for students and young builders (ages 13–24).

## Architecture & Build Rules
- Static HTML/CSS/vanilla JS site built via Python scripts (`build.py` and `build_app.py`) from `src/` and `data/stories/*.json`.
- No frontend bundlers. Always run `python build.py` after editing templates or `data/stories/*.json`.
- Backend integrations: Supabase (profiles, progress, community chat, billing, assistant edge functions), Clerk auth, Stripe billing.

## Editorial & Brand Standards
- **Real before impressive:** Every revenue or user metric must cite its source and date (e.g., Stripe via TrustMRR), and drops must be shown honestly.
- **Privacy:** Never publish the site creator's personal name, age, location, or photo.
- **Accessibility:** Maintain WCAG AA contrast, `prefers-reduced-motion` support, and responsive mobile-first layouts.
