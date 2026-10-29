# Product API Studio — Frontend

This frontend uses plain HTML, CSS, and JavaScript to test your existing Express CRUD API.

## Files

- `public/index.html` — dashboard and forms for GET all, GET by ID, POST, PUT, DELETE
- `public/styles.css` — responsive styling
- `public/app.js` — sends real `fetch()` requests and renders status codes and JSON responses

## Install into your existing project

1. Copy the `public` folder from this package into the same directory as your existing `server.js`.
2. In `server.js`, add this import near the top:

   ```js
   const path = require("path");
   ```

3. After `app.use(express.json());`, add:

   ```js
   app.use(express.static(path.join(__dirname, "public")));
   ```

4. Keep your existing API routes and CRUD logic unchanged.
5. Save the files and restart the server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` in your browser.

## Notes

- The frontend sends requests to the same origin, under `/api/products`, so no CORS package is needed.
- Product records are stored in memory by the existing API. Changes are lost when the server restarts.
- Do not open `index.html` directly as a `file://` page; open it through the Express server at `http://localhost:3000`.
- Postman is not required. Continue using Thunder Client when you want to compare requests.
