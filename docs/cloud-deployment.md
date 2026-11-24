# Private cloud deployment

Single-owner workspace; not a public multi-tenant SaaS. Use a dedicated x86-64 Linux VM (suggested 8 vCPU, 16 GB RAM, 160 GB storage). No GitHub Actions or always-on Mac required. Provisioning is not automatic.

1. Install Node 22, Git, JDK 21 and the reviewed upstream Android SDK/NDK, Rust and native build prerequisites. The native build recipes have not yet been validated on a real runner. Do not grant a public service access to a Docker socket.
2. Create an unprivileged manager-sdk system account and directories /opt/manager-sdk, /var/lib/manager-sdk, /etc/manager-sdk. Clone Manager-SDK into /opt/manager-sdk; run npm install, npm test and npm run build. Ensure the account can read the app and write its own caches and private state directory.
3. Copy deploy/config.example to /etc/manager-sdk/config (root-owned mode 0600). Set the exact HTTPS origin, SDK paths and reviewed framework:commit pairs. Generate a random password using openssl rand -hex 32 and save it in /etc/manager-sdk/password (root-owned, service group readable, mode 0640). Never commit credentials.
4. Install deploy/manager-sdk.service in /etc/systemd/system; adjust the Node executable path if necessary. Run systemctl daemon-reload and systemctl enable --now manager-sdk. Inspect journalctl -u manager-sdk for errors.
5. Configure Caddy using deploy/Caddyfile.example and point your domain at the server. Keep port 8787 loopback-only. Use HTTPS, restrict access via VPN/firewall when possible, and keep SSH restricted.
6. Authenticate at your HTTPS domain. Jobs persist after closing the browser. Reopen the workspace to see saved jobs. Interrupted builds are not automatically rerun.

## Security limits

Only trusted, reviewed upstream source is allowed. This is not a hardened sandbox. Use a dedicated VM and separate signing boundary before untrusted or multi-tenant workloads. Protect and back up signing keys and artifacts, monitor storage, and keep the server patched. This service does not install root engines or establish physical-device root functionality. A verified APK signature is not proof of engine authorization.

