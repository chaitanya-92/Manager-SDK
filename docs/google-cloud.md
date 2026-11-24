# Google Cloud deployment: private workspace preview

This path deploys the frontend and its status API to Cloud Run. Cloud Build runs the repository tests and creates the container, not Android APKs. The VM worker remains separate; it is not enabled in this image. Cloud Run is ephemeral and must not hold client signing keys or run detached builds. A production Android worker requires a separately tested isolated build recipe, persistent private artifacts and signing identities, durable job state and a budget gate.

## 1. Create project and billing

Open https://console.cloud.google.com/projectcreate and create a project. Link an eligible billing account and configure a small budget alert before enabling services. Budgets are not hard caps. The Cloud Build promotional free tier is limited to 2,500 minutes/month on the default E2_STANDARD_2 pool. Registry, storage and network may incur charges.

## 2. In Google Cloud Shell

Open https://shell.cloud.google.com and run the following after replacing YOUR_PROJECT_ID:

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iap.googleapis.com
git clone https://github.com/chaitanya-92/Manager-SDK.git
cd Manager-SDK
gcloud artifacts repositories create manager-sdk --repository-format=docker --location="$REGION"
```

If the registry already exists, skip its creation.

## 3. Create a dedicated Cloud Build identity

```bash
gcloud iam service-accounts create manager-sdk-build
gcloud iam service-accounts create manager-sdk-web
export BUILD_SA="manager-sdk-build@$PROJECT_ID.iam.gserviceaccount.com"
export WEB_SA="manager-sdk-web@$PROJECT_ID.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$BUILD_SA" --role=roles/logging.logWriter
gcloud artifacts repositories add-iam-policy-binding manager-sdk --location="$REGION" --member="serviceAccount:$BUILD_SA" --role=roles/artifactregistry.writer
```

The owner submitting builds needs Cloud Build submission and service-account actAs permissions; the owner deploying Cloud Run needs deployment and runtime service-account actAs permissions. The source staging bucket must permit the build account to read the uploaded source archive. If the first submission fails on that permission, locate the staging bucket in the error or Cloud Build configuration and grant the build account roles/storage.objectViewer on that bucket only. Do not grant project-wide Editor to build identities. The web runtime identity needs no application data permissions in this preview.

## 4. Build and deploy

```bash
gcloud builds submit --region="$REGION" --config=cloudbuild.yaml --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA" --substitutions="_REGION=$REGION" .
```

Copy the successful build ID printed by the command, and substitute it below.

```bash
export BUILD_ID=REPLACE_WITH_SUCCESSFUL_BUILD_ID
gcloud run deploy manager-sdk --image="$REGION-docker.pkg.dev/$PROJECT_ID/manager-sdk/web:$BUILD_ID" --region="$REGION" --service-account="$WEB_SA" --no-allow-unauthenticated --min=0 --max=1 --memory=512Mi --cpu=1
```

For browser sign-in, enable Identity-Aware Proxy directly on the service in the Cloud Run console (Security tab), then grant your Google account IAP-Secured Web App User access. Personal projects may require configuring OAuth consent. See https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run. Do not grant allUsers access.

## 5. Confirm

Open the service URL after signing in. The UI must report that the Android build worker is unavailable. No custom APK is created by this deployment. Verify Cloud Build test results and Cloud Run logs in the console. The Mac may remain off after deployment.

## Production work outstanding

- Separate isolated, reviewed Android compilation runner and secure signing boundary.
- Durable authenticated job queue and private artifact storage (Supabase or equivalent).
- Verified APK pipeline and authorized device acceptance.
- Cost guardrails for build requests, retries, and storage retention.

Official references: https://cloud.google.com/build/pricing and https://docs.cloud.google.com/run/docs/container-contract
