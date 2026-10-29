# Contributing to UIU Academic Calendar Tracker

Thank you for your interest in improving this project! Follow these simple guidelines to submit contributions.

---

## Quick Workflow

### 1. Fork & Clone
Fork the repository on GitHub, then clone your fork:
```bash
git clone https://github.com/<your-username>/Academic-Calendar-Tracker.git
cd Academic-Calendar-Tracker
```

### 2. Set Up Upstream
Keep your fork in sync with the main repository:
```bash
git remote add upstream https://github.com/tanvir64/Academic-Calendar-Tracker.git
git fetch upstream
```

### 3. Create a Feature Branch
Create a descriptive branch off `main`:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 4. Make & Test Changes
- Open `index.html` in your browser to verify changes.
- Ensure the layout is responsive on both mobile and desktop.
- Verify existing `localStorage` data loading is not broken.
- Check the browser DevTools console for zero JavaScript errors.

### 5. Commit with Conventional Format
Use clear, concise commit messages:
```bash
git add .
git commit -m "feat: add export/import backup feature"
# Examples: fix: ..., docs: ..., style: ..., refactor: ...
```

### 6. Push & Open a Pull Request
Push to your fork:
```bash
git push origin feature/your-feature-name
```
Then visit GitHub and click **"Compare & pull request"**.

---

## Code Guidelines

- **Zero-Build Simplicity**: Avoid adding complex build tools or heavy dependencies. Keep it runnable with pure HTML/JS/CSS.
- **Mobile-First**: Always verify mobile responsiveness.
- **Privacy & Safety**: Keep user data client-side in `localStorage`.

