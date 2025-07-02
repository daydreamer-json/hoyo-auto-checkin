# hoyo-auto-checkin

HoYoLAB Auto checkin (claim) script

# How to use

Please refer to [config_auth.example.yaml](config/config_auth.example.yaml) and create `config_auth.yaml`.

Please search online for how to obtain your Discord UID and HoYoLAB UID.

You can obtain your `ltoken` by logging into HoYoLAB on your PC browser and viewing it from the developer tools (in Chrome, go to "Application" -> "Cookies"). If the `ltoken` value starts with `v2`, please set `hoyolabCookieVersion` to `2`.

You can control which game's login bonus to claim with `enableService`.

Once `config_auth.yaml` is complete, fork this repository and create a new repository secret from "Actions" in "Secrets and variables" in the repository settings.  
Set the name to `CONFIG_AUTH_YAML`.
Paste the contents of `config_auth.yaml` into the secret.

That's it! You're done.

---

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

This project was created using `bun init` in bun v1.2.8. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
