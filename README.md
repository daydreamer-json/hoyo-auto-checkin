# hoyo-auto-checkin

A simple script for automatic check-in (claim) and automatic redemption of gift code rewards on HoYoLAB.  
It is designed to run on GitHub Actions.

## Features

- Automatic claim of login bonuses on HoYoLAB
- Automatic search and redemption of gift codes
  - Currently, codes are obtained from the following sources:
    - HoYoLAB Official ("Quick Claim")
    - Posts within the HoYoLAB community
    - Fandom Wiki
    - GameWith
  - Detect and exclude expired codes as much as possible
    - Automatically detects expired code from some of the aforementioned sources
    - You can explicitly specify known expired codes in [`config.yaml`](config/config.yaml)

## How to use

Fork or import this repository.

Please refer to [`config_auth.example.yaml`](config/config_auth.example.yaml) and create `config_auth.yaml` in your local environment.

You can obtain your `ltoken` by logging into HoYoLAB on your PC browser and viewing it from the developer tools (in Chrome, go to "Application" -> "Cookies"). If the `ltoken` value starts with `v2`, please set `hoyolabCookieVersion` to `2`.

Create a new repository secret from "Actions" in "Secrets and variables" in the repository settings.  
Set the name to `CONFIG_AUTH_YAML`.
Paste the contents of `config_auth.yaml` into the secret.

> [!IMPORTANT]  
> **Daily scheduled trigger in GitHub Actions are disabled by default** due to extremely low time precision. (~1h)  
> If you wish to use scheduled triggers, please uncomment the relevant section in [`.github/workflows/main.yml`](.github/workflows/main.yml).  
> Or, you can use the method described later for scheduling with higher time precision.

### Alt. schedule trigger method

You can use [cron-job.org](https://cron-job.org/).  

Create a new cron job with the URL set to `https://api.github.com/repos/YOUR_GITHUB_USERNAME/YOUR_FORKED_REPO_NAME/dispatches`.  
You can set the execution schedule as you like, but I recommend setting it to 0:00 China Standard Time (16:00 UTC).

In the Advanced tab, configure various HTTP headers.  
Specify `token YOUR_GITHUB_ACCESS_TOKEN` in the `Authorization` header.  
Specify `application/json` in the `Content-Type` header.

Select the `POST` request method.  
Specify `{"event_type":"auto_claim"}` in the request body.

---

## For dev

To install dependencies:

```bash
bun install
```

This project was created using `bun init` in bun v1.2.8. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
