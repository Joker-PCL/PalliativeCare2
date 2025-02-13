<!-- Example -->
    https://youtu.be/iQfs4PM2UYA?si=jEG0KzftEKIMwCaR
    https://github.com/google/clasp

<!-- คำสั่งติดตั้ง -->
    - cd project
    - npm install -g @google/clasp
    - clasp login

    ** เปิด Google Apps Script API
    ** Then enable the Google Apps Script API: https://script.google.com/home/usersettings

    - npm init
    - clasp clone ...scriptID...
    - clasp -v  > v.1.15
    - npm i -D @types/google-apps-script

    ** update code from vscode to google app script
    - clasp push

    ** update code google app script to vscode
    - clasp pull

    ** auto update code from vscode to google app script
    - clasp push -w