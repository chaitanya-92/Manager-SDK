# Connect Render to CircleCI

This connects workspace verification only. The Android APK build endpoint remains disabled.

1. In CircleCI User Settings > Personal API Tokens, create a token with a short expiry and keep it private. Personal tokens have broad account permissions; use a dedicated limited account where possible.
2. In Manager-SDK Project Settings > Overview copy the complete project slug (not just the project UUID). In Project Settings > Pipelines copy the pipeline Definition ID. Verify that the definition points to the Manager-SDK repository and .circleci/config.yml.
3. In Render Environment add CIRCLECI_TOKEN, CIRCLECI_PROJECT_SLUG, CIRCLECI_PIPELINE_DEFINITION_ID. Never add them to browser code or commit a token. Redeploy latest main.
4. Open the owner-authenticated workspace, find CircleCI connection and click Check connection. It lists recent main pipelines and workflows. Run workspace checks explicitly if needed. This consumes credits; no automatic retry is performed. The temporary cooldown is not a billing cap.
5. Verify the job succeeds in CircleCI. The Build custom APK button remains disabled. No production signing key or client data is sent to CircleCI in this connection.

Reference: https://circleci.com/docs/api/v2/ and https://circleci.com/docs/guides/toolkit/managing-api-tokens/
