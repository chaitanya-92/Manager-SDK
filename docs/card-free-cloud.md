# Card-free cloud workspace

Render hosts the private UI and project API. Supabase persists project configurations. CircleCI runs workspace unit tests and web production builds; it does not compile Android APKs. Existing local and VPS Android workers are retained separately and remain unvalidated. No root engine installation or device verification is performed by this deployment.

1. Create a dedicated free Supabase project at https://supabase.com/dashboard (do not use another application's database unless you explicitly intend to share it). In SQL Editor run deploy/supabase-projects.sql. The table is server-only: RLS is enabled and anon/authenticated have no grants. No signing keys are stored here.
2. In Render at https://dashboard.render.com create a Blueprint from chaitanya-92/Manager-SDK main using render.yaml. Choose Free. Connect GitHub when requested. Enter SUPABASE_URL and SUPABASE_SERVER_KEY directly in Render (prefer a server-side secret key). Never paste them into the chat or commit them. The blueprint generates a strong owner password. Retrieve it from Render's environment settings and sign in at the HTTPS service URL with username owner. Healthz is public but contains no user data.
3. Open the workspace, fill in a valid configuration, save it, reload and reopen the saved project. Save and retrieval are the acceptance test for this deployment. If database requests fail check project status, Data API access and grants.
4. Optional: connect the GitHub project at https://app.circleci.com to verify the web workspace. The CircleCI workflow uses the small resource class and does not publish APKs.
5. Free Render instances can sleep and have ephemeral filesystems. Supabase is needed for persisted client configuration. Keep free plans; monitor credits, storage and provider terms. No persistent Android worker or signing key storage is configured on Render. 

## Remaining acceptance gates

Actual custom APK compilation requires a validated Android runner, independent signing boundary and authorized device testing. Do not label the service an end-to-end Android build factory or claim root until these gates have been tested. A regular APK cannot by itself root a stock device.

## Troubleshooting: Google Cloud preview on Render

If the UI says Google Cloud preview, the wrong server was started. The Docker image now detects Render and uses the private Render API; it refuses to fall back to preview when credentials are missing. In Render Environment, configure MANAGER_SDK_USER=owner, a random MANAGER_SDK_PASSWORD of at least 24 characters, SUPABASE_URL and SUPABASE_SERVER_KEY. Set MANAGER_SDK_HOST=render. The exact HTTPS origin is taken from RENDER_EXTERNAL_URL unless overridden by MANAGER_SDK_ORIGIN. Redeploy latest main. For a native Node service use start command node worker/hosted-start.mjs. For Docker use the image default CMD; remove any override that launches gcp-web.mjs. After sign-in, /api/factory/status should report mode render and projectsAvailable true. /healthz alone does not prove the project database works. Verify by saving and reopening a project. Android compilation remains disconnected.
