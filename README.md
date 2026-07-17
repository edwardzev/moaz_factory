# Express.js on Vercel

Basic Express.js + Vercel example that serves html content, JSON data and simulates an api route.

## How to Use

You can choose from one of the following two methods to use this repository:

### One-Click Deploy

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=vercel-examples):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/vercel/examples/tree/main/solutions/express&project-name=express&repository-name=express)

### Clone and Deploy

```bash
git clone https://github.com/vercel/examples/tree/main/solutions/express
```

Install the Vercel CLI:

```bash
npm i -g vercel
```

Then run the app at the root of the repository:

```bash
vercel dev
```

## Mobile home-screen app

The production tracker exposes a web app manifest and standalone display metadata for Android and iOS home-screen installation.

- Android/Chrome: open the deployed HTTPS URL and choose **Install app** or **Add to Home screen**.
- iPhone/iPad/Safari: open the deployed HTTPS URL, choose **Share**, then **Add to Home Screen**.

The installed app still requires network access for current Airtable data and operational actions. Its service worker caches only the static application shell; `/api/*` requests are always sent to the network and are never served from cache.
