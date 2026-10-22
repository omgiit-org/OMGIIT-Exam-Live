OMGIIT STUDENT EXAM PORTAL — GOOGLE DRIVE BACKEND STARTER

WHAT THIS PACKAGE CONTAINS
- omgiit_admin_exam_portal.html: the current front-end prototype (still uses browser-local storage until connected to the API).
- Code.gs: Google Apps Script backend starter. It creates a spreadsheet stored in your Google Drive and provides authenticated admin operations for students, assignments, settings, results, and delete-all.

IMPORTANT STATUS
This package is NOT yet connected end-to-end: the HTML front end still uses localStorage. Do not upload the HTML and assume data is syncing to Drive. The deployed Apps Script URL must be configured in the front end and its actions wired to the API. A browser-based static site cannot access your Drive account just from the email address.

SETUP GOOGLE DRIVE BACKEND
1. Sign in to Google as omgiit.edu@gmail.com.
2. Open https://script.google.com/ and create a New project named OMGIIT Exam Portal Backend.
3. Replace the default Code.gs content with the Code.gs file included in this package.
4. In Project Settings > Script Properties, add:
   ADMIN_USERNAME = your chosen admin username
   ADMIN_PASSWORD = a NEW strong password (do not keep CHANGE-THIS-PASSWORD-NOW)
5. Select setupOmgIitBackend in the function dropdown and click Run. Review and accept Google permissions. It creates a spreadsheet in Drive and a folder named OMGIIT Exam Portal Data. Keep the spreadsheet private to the institute.
6. Click Deploy > New deployment > Web app.
   Execute as: Me (your Google account)
   Who has access: Anyone (required for a public GitHub Pages front-end; admin actions still require the server-side admin login token).
7. Deploy, authorize if prompted, and copy the Web app URL ending in /exec. Keep the URL for front-end integration.
8. Test by opening the URL in a browser. It should return a small JSON message that says the backend is running.

API OPERATIONS PROVIDED (POST JSON)
- {"action":"adminLogin","username":"...","password":"..."}
- {"action":"list","token":"..."}
- {"action":"saveStudent","token":"...","student":{"name":"...","username":"...","password":"...","course":"OS-CIT","setLimit":20,"attemptLimit":3,"status":"active"}}
- {"action":"deleteStudent","token":"...","id":"..."}
- {"action":"saveAssignment","token":"...","assignment":{"title":"...","course":"OS-CIT","due":"...","description":"..."}}
- {"action":"deleteAssignment","token":"...","id":"..."}
- {"action":"saveSettings","token":"...","settings":{"questions":50,"duration":60,"sets":20,"attempts":3}}
- {"action":"saveResult","token":"...","result":{"studentId":"...","studentName":"...","course":"OS-CIT","set":1,"correct":40,"total":50,"answered":45,"percent":80,"date":"...","details":{}}}
- {"action":"deleteResult","token":"...","id":"..."}
- {"action":"deleteAllData","token":"...","confirmation":"DELETE ALL OMGIIT DATA"}

SECURITY / LIMITATIONS
- Never share your Google password or Apps Script edit access.
- The spreadsheet is stored in Drive under the account that deploys the script. The email alone does not grant the website access.
- Admin token sessions expire after 6 hours.
- Student password hashes are stored instead of plaintext in the backend; the current HTML prototype still shows demo passwords locally until fully integrated. Do not use it for real student data yet.
- Delete-all is destructive. It requires the exact confirmation string and removes records while preserving sheet headers.
- Before production use, the front-end must be wired to the deployed API and student login/exam submission must be validated server-side. The current prototype's exam scoring and attempt limits are client-side and can be tampered with.
