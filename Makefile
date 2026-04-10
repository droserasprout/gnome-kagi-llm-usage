UUID    := kagi-llm-usage@drsr.io
DESTDIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install uninstall enable disable reload restart nested logs zip

install:
	rsync -a --exclude='.git' --exclude='Makefile' . $(DESTDIR)/
	glib-compile-schemas $(DESTDIR)/schemas/

uninstall:
	rm -rf $(DESTDIR)

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

# X11 only
reload:
	dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell \
		org.gnome.Shell.Eval string:'Meta.restart("Restarting GNOME Shell")'

# Wayland: nested GNOME Shell session in a window for testing
nested:
	dbus-run-session gnome-shell --devkit --wayland

logs:
	journalctl -f /usr/bin/gnome-shell

zip:
	rm -f $(UUID).zip
	zip -r $(UUID).zip extension.js prefs.js stylesheet.css metadata.json LICENSE kagi-icon-32.png schemas/
