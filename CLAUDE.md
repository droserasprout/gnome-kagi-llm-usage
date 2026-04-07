# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

A GNOME Shell extension that displays Kagi billing usage in the top panel. Written in GJS (GNOME JavaScript), using GNOME libraries via GObject Introspection. Based on [claude-usage-extension](https://github.com/Haletran/claude-usage-extension) by Baptiste-Pasquier.

## Development Commands

```bash
make install    # Install extension locally and compile schemas
make uninstall  # Remove extension
make enable     # Enable extension
make disable    # Disable extension
make reload     # Reload GNOME Shell (X11 only)
make nested     # Nested GNOME Shell session for Wayland testing
make logs       # View extension logs
```

## Architecture

- **`extension.js`** -- Main extension logic. `KagiUsageExtension` (GNOME Extension class) creates a `KagiUsageIndicator` (subclass of `PanelMenu.Button`) and adds it to the shell panel.
- **`prefs.js`** -- Preferences UI using `Adw`/`Gtk`. Loaded in a separate process by GNOME when user opens settings.
- **`schemas/`** -- GSettings schema defining persisted settings: `session-link`, `refresh-interval`, `display-mode`, `icon-style`, `show-icon`, `proxy-url`.
- **`stylesheet.css`** -- CSS for panel widget styling (progress bar colors, layout).

## Key Implementation Details

- The user provides a Kagi session link (e.g. `https://kagi.com/search?token=TOKEN&q=%s`) in settings; the `token` param is extracted and sent as `Cookie: kagi_session=TOKEN` to `https://kagi.com/settings/billing`.
- Billing data is scraped from the HTML response using a regex against `<div class="billing_box_count_num"><span>$SPENT</span>/TOTAL</div>`.
- The panel indicator supports three display modes: `text` (percentage label), `bar` (mini progress bar), `both`.
- Progress bar color is driven by CSS classes: `usage-low` / `usage-medium` / `usage-high` / `usage-critical` (thresholds: 40/70/90%).
- Schema changes require recompiling with `glib-compile-schemas` and reloading the shell.
