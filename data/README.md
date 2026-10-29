# Academic Calendar Data Guide

This folder contains the master schedule data for the Academic Calendar Tracker.

## How to Update for a New Trimester

When a new trimester's official academic calendar is released by UIU (e.g. Spring 2027 / Term 271):

1. **Update `TERM_CONFIG` in `calendar-data.js`**:
   - Change `termCode` (e.g. `"271"`).
   - Change `termName` (e.g. `"Spring 2027"`).
   - Set `startDate` and `endDate`.

2. **Update `ALL_CLASSES`**:
   - Add the scheduled class dates for SAT, SUN, TUE, WED tracks and any Thursday online makeup sessions.
   - Each item specifies:
     ```javascript
     {
       id: "unique-date-id",     // e.g. "mar-02"
       dateStr: "YYYY-MM-DD",     // e.g. "2027-03-02"
       month: "MONTH_CODE",       // e.g. "MAR"
       dayNum: 2,
       dayName: "DAY_NAME",       // "SAT", "SUN", "TUE", "WED", "THU"
       track: "TRACK_NAME",       // "SAT", "SUN", "TUE", "WED"
       classNo: 1,                // Session number (1-12)
       isMakeup: false,           // true if online makeup Thursday
       makeupFor: "TRACK_NAME"    // Optional: track being compensated
     }
     ```

3. **Update `ACADEMIC_EVENTS`**:
   - Add important university milestones: tuition deadlines, exam dates, advising periods, and holidays.
   - Category can be: `"ACADEMIC"`, `"PAYMENT"`, `"HOLIDAY"`, or `"EXAM"`.

4. **Update `MIDTERM_DAYS` and `FINAL_DAYS`**:
   - Set the Day 1 through Day 7 examination dates.

Once tested in `index.html`, submit a Pull Request!

