# UIU Academic Calendar & Class Tracker (Term 263)

A lightweight, zero-dependency academic dashboard built for **United International University (UIU)** students for **Fall 2026 (Term 263)**, based on the official university schedule.

---

## Features

- **Calendar Grid**: Visual layout of all 48 sessions across SAT, SUN, TUE, WED tracks and Online Makeup classes.
- **Track Progress**: Track completed vs. remaining classes with automatic progress meters.
- **Assessment Planner**: Schedule and monitor exams, quizzes, lab tasks, presentations, and assignments with dynamic urgency badges.
- **University Events**: Keep track of tuition deadlines, advising dates, exam weeks, and official holidays.
- **Online Meeting Links**: Store and quickly launch Zoom or Google Meet links for makeup classes.
- **Offline & Private**: Fully client-side using `localStorage`. No accounts, servers, or external databases needed.

---

## Getting Started

No build tools, package managers, or installation required.

### Option 1: Direct File
Simply double-click `index.html` to open it in any modern web browser.

### Option 2: Local HTTP Server (Optional)
If you prefer running a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```
Then visit `http://localhost:8000` in your browser.

---

## Tech Stack

- **HTML5 & Vanilla JavaScript** (ES6+)
- **Tailwind CSS** (via CDN)
- **Lucide Icons** (via CDN)

---

## Updating for a New Trimester

All schedule data is cleanly decoupled into [data/calendar-data.js](data/calendar-data.js). When UIU releases an academic calendar for a new trimester, simply update that file and submit a Pull Request. See [data/README.md](data/README.md) for details.

---

## Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for branch guidelines and contribution workflow.

---

## License

This project is open-source under the [MIT License](LICENSE).

