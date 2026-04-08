# Kagi LLM Usage

![GNOME Shell 46+](https://img.shields.io/badge/GNOME%20Shell-46%2B-blue)

A GNOME Shell extension that displays your [Kagi](https://kagi.com) billing usage in the top panel. Requires a Kagi session token (see [Configuration](#configuration)).

## Features

- Kagi LLM usage monitoring (scraped from the billing page)
- Multiple display modes: text percentage, progress bar, or both
- Billing cycle timeline with renewal countdown
- HTTP proxy support

## Installation

### Manual

```bash
git clone https://github.com/droserasprout/kagi-usage-extension
cd kagi-usage-extension
make install
```

### Configuration

1. Open the extension settings
2. Paste your Kagi session link (e.g. `https://kagi.com/search?token=TOKEN&q=%s`)
3. The extension extracts the token and fetches billing data from `https://kagi.com/settings/billing`

## Credits

Original extension by [Baptiste-Pasquier](https://github.com/Haletran) ([claude-usage-extension](https://github.com/Haletran/claude-usage-extension)).

License: [MIT](LICENSE)
