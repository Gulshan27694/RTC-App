1. Initialize Project
bash
mkdir rtc-app
cd rtc-app
npm init -y


2. Install Required Packages
bash
npm install express socket.io cors multer


3. Basic Project Structure
rtc-app/
│
├── server.js          # Main backend file
├── public/             # Frontend HTML, JS, CSS
│   ├── index.html
│   ├── script.js
│   └── style.css
├── uploads/            # For uploaded files
├── package.json

 5. Start the Server
If using plain Node.js:
bash
node server.js
or node server/index.js  #if index.js is server file 
