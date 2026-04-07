import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Soup from 'gi://Soup';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const BILLING_URL = 'https://kagi.com/settings/billing';

const KagiUsageIndicator = GObject.registerClass(
class KagiUsageIndicator extends PanelMenu.Button {
    _init(extensionPath, settings, openPreferences) {
        super._init(0.0, 'Kagi Usage Indicator');

        this._extensionPath = extensionPath;
        this._settings = settings;
        this._openPreferences = openPreferences;
        this._session = this._createSession();

        this._box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });

        const iconPath = GLib.build_filenamev([this._extensionPath, 'kagi-icon-32.png']);
        const gicon = Gio.icon_new_for_string(iconPath);
        this._icon = new St.Icon({
            gicon: gicon,
            style_class: 'kagi-icon',
            icon_size: 16,
        });
        this._box.add_child(this._icon);

        this._panelProgressBg = new St.Widget({
            style_class: 'kagi-panel-progress-bg',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._panelProgressBar = new St.Widget({
            style_class: 'kagi-panel-progress-bar',
        });
        this._panelProgressBg.add_child(this._panelProgressBar);
        this._box.add_child(this._panelProgressBg);

        this._label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'kagi-usage-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        this._createMenu();

        this._updateDisplayMode();
        this._updateIconVisibility();
        this._updateIconStyle();

        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'refresh-interval') {
                this._restartTimer();
            } else if (key === 'display-mode') {
                this._updateDisplayMode();
            } else if (key === 'show-icon') {
                this._updateIconVisibility();
            } else if (key === 'proxy-url') {
                this._recreateSession();
            } else if (key === 'icon-style') {
                this._updateIconStyle();
            } else if (key === 'session-link') {
                this._refreshUsage();
            }
        });

        this._refreshUsage();
        this._startTimer();
    }

    _updateDisplayMode() {
        const mode = this._settings.get_string('display-mode');
        if (mode === 'bar') {
            this._panelProgressBg.show();
            this._label.hide();
            this._label.set_style('margin-left: 0;');
        } else if (mode === 'both') {
            this._panelProgressBg.show();
            this._label.show();
            this._label.set_style('margin-left: 6px;');
        } else {
            this._panelProgressBg.hide();
            this._label.show();
            this._label.set_style('margin-left: 0;');
        }
    }

    _updateIconVisibility() {
        const showIcon = this._settings.get_boolean('show-icon');
        if (showIcon) {
            this._icon.show();
        } else {
            this._icon.hide();
        }
    }

    _createSession() {
        const session = new Soup.Session();
        const proxyUrl = this._settings.get_string('proxy-url');

        if (proxyUrl && proxyUrl.trim() !== '') {
            const proxyResolver = Gio.SimpleProxyResolver.new(proxyUrl.trim(), null);
            session.set_proxy_resolver(proxyResolver);
        }

        return session;
    }

    _recreateSession() {
        if (this._session) {
            this._session.abort();
        }
        this._session = this._createSession();
        this._refreshUsage();
	}
    _updateIconStyle() {
        const style = this._settings.get_string('icon-style');
        const desatName = 'monochrome-desaturate';
        const brightName = 'monochrome-brightness';
        const hasEffect = this._icon.get_effect(desatName) !== null;

        if (style === 'monochrome' && !hasEffect) {
            this._icon.add_effect(new Clutter.DesaturateEffect({factor: 1.0, name: desatName}));
            const brightnessEffect = new Clutter.BrightnessContrastEffect({name: brightName});
            brightnessEffect.set_brightness_full(1, 1, 1);
            this._icon.add_effect(brightnessEffect);
        } else if (style !== 'monochrome' && hasEffect) {
            this._icon.remove_effect_by_name(desatName);
            this._icon.remove_effect_by_name(brightName);
        }
    }

    _createMenu() {
        const billingBox = new St.BoxLayout({
            style_class: 'kagi-usage-section',
            vertical: true,
        });
        const billingHeader = new St.BoxLayout({ vertical: false });
        const billingLabel = new St.Label({
            text: 'Usage',
            style_class: 'kagi-section-title',
        });
        billingHeader.add_child(billingLabel);
        this._billingPercent = new St.Label({
            text: '...',
            style_class: 'kagi-percent-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
        });
        billingHeader.add_child(this._billingPercent);
        billingBox.add_child(billingHeader);

        const barWrapper = new St.Widget({
            style: 'width: 200px; height: 8px;',
        });
        const barBg = new St.Widget({ style_class: 'kagi-progress-bg' });
        barBg.set_size(200, 8);
        barBg.set_position(0, 0);
        barWrapper.add_child(barBg);

        this._spendingFill = new St.Widget({ style_class: 'kagi-progress-bar usage-low' });
        this._spendingFill.set_size(0, 8);
        this._spendingFill.set_position(0, 0);
        barWrapper.add_child(this._spendingFill);

        this._timelineTick = new St.Widget({ style_class: 'kagi-timeline-tick' });
        this._timelineTick.set_size(2, 8);
        this._timelineTick.set_position(0, 0);
        barWrapper.add_child(this._timelineTick);
        billingBox.add_child(barWrapper);

        this._billingDetail = new St.Label({
            text: '...',
            style_class: 'kagi-reset-label',
        });
        billingBox.add_child(this._billingDetail);

        this._timelineResetLabel = new St.Label({
            text: 'Resets: ...',
            style_class: 'kagi-reset-label',
        });
        billingBox.add_child(this._timelineResetLabel);

        const billingItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        billingItem.add_child(billingBox);
        this.menu.addMenuItem(billingItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            Promise.resolve(this._openPreferences()).catch(e => {
                console.error('Kagi Usage: Failed to open preferences:', e);
            });
        });
        this.menu.addMenuItem(settingsItem);
    }

    _startTimer() {
        const interval = this._settings.get_int('refresh-interval');
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refreshUsage();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    _restartTimer() {
        this._stopTimer();
        this._startTimer();
    }

    _refreshUsage() {
        const sessionLink = this._settings.get_string('session-link');
        if (!sessionLink) {
            this._label.set_text('No token');
            this._billingPercent.set_text('No session link');
            this._billingDetail.set_text('Set a session link in settings');
            return;
        }
        try {
            const tokenMatch = sessionLink.match(/[?&]token=([^&]+)/);
            if (!tokenMatch) throw new Error('no token param in session link');
            this._fetchBilling(tokenMatch[1]);
        } catch (e) {
            console.error('Kagi Usage: Failed to parse session link:', e.message);
            this._label.set_text('Error');
            this._billingPercent.set_text('Invalid session link');
            this._billingDetail.set_text('—');
        }
    }

    _fetchBilling(token) {
        const message = Soup.Message.new('GET', BILLING_URL);
        message.request_headers.append('Cookie', `kagi_session=${token}`);

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);

                    if (message.status_code !== 200) {
                        this._label.set_text('Error');
                        this._billingPercent.set_text(`HTTP ${message.status_code}`);
                        this._billingDetail.set_text('—');
                        return;
                    }

                    const decoder = new TextDecoder('utf-8');
                    const html = decoder.decode(bytes.get_data());
                    const data = this._parseUsage(html);

                    if (!data) {
                        this._label.set_text('Error');
                        this._billingPercent.set_text('Could not parse billing');
                        this._billingDetail.set_text('—');
                        return;
                    }

                    this._updateDisplay(data);
                } catch (e) {
                    console.error('Kagi Usage: Failed to fetch billing:', e.message);
                    this._label.set_text('Error');
                }
            }
        );
    }

    _parseUsage(html) {
        const usageMatch = html.match(
            /class="billing_box_count_num">\s*<span\s*>\$([\d.]+)<\/span>\/([\d.]+)/
        );
        if (!usageMatch) return null;
        const spent = parseFloat(usageMatch[1]);
        const total = parseFloat(usageMatch[2]);
        const percent = total > 0 ? (spent / total) * 100 : 0;

        const renewalMatch = html.match(/Next renewal is\s*<b>([\d-]+)<\/b>/);
        const nextRenewal = renewalMatch ? renewalMatch[1] : null;

        const paymentMatch = html.match(/Last payment was\s*<b>USD\s*\$([\d.]+)<\/b>\s*on\s*<b>([\d-]+)<\/b>/);
        const lastPaymentDate = paymentMatch ? paymentMatch[2] : null;

        return { spent, total, percent, nextRenewal, lastPaymentDate };
    }

    _formatResetTime(isoString) {
        try {
            const resetDate = new Date(isoString);
            const now = new Date();
            const diffMs = resetDate - now;

            if (diffMs < 0) return 'now';

            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                return `${diffDays}d ${diffHours % 24}h`;
            } else if (diffHours > 0) {
                return `${diffHours}h ${diffMins % 60}m`;
            } else {
                return `${diffMins}m`;
            }
        } catch (e) {
            return '—';
        }
    }

    _updateDisplay(data) {
        this._label.set_text(`${Math.round(data.percent)}%`);
        this._updatePanelProgressBar(data.percent);
        this._billingPercent.set_text(`${data.percent.toFixed(1)}%`);
        this._billingDetail.set_text(`$${data.spent.toFixed(2)} / $${data.total.toFixed(2)}`);
        this._spendingFill.set_width(Math.round((Math.min(100, data.percent) / 100) * 200));

        if (data.nextRenewal && data.lastPaymentDate) {
            const now = new Date();
            const start = new Date(data.lastPaymentDate);
            const end = new Date(data.nextRenewal);
            const totalMs = end - start;
            const elapsedMs = now - start;
            const timelinePercent = totalMs > 0
                ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
                : 0;
            const tickX = Math.round((timelinePercent / 100) * 200) - 1;
            this._timelineTick.set_position(tickX, 0);
            this._timelineResetLabel.set_text(
                `Resets in ${this._formatResetTime(data.nextRenewal)}`
            );
        } else {
            this._timelineResetLabel.set_text('Resets: unknown');
        }
    }

    _updatePanelProgressBar(usage) {
        const maxWidth = 50;
        const width = Math.round((Math.min(100, Math.max(0, usage)) / 100) * maxWidth);
        this._panelProgressBar.set_width(width);
    }

    _updateProgressBar(progressBar, usage) {
        const maxWidth = 200;
        const width = Math.round((Math.min(100, Math.max(0, usage)) / 100) * maxWidth);
        progressBar.set_width(width);

        progressBar.remove_style_class_name('usage-low');
        progressBar.remove_style_class_name('usage-medium');
        progressBar.remove_style_class_name('usage-high');
        progressBar.remove_style_class_name('usage-critical');

        if (usage >= 90) {
            progressBar.add_style_class_name('usage-critical');
        } else if (usage >= 70) {
            progressBar.add_style_class_name('usage-high');
        } else if (usage >= 40) {
            progressBar.add_style_class_name('usage-medium');
        } else {
            progressBar.add_style_class_name('usage-low');
        }
    }

    destroy() {
        this._stopTimer();
        if (this._session) {
            this._session.abort();
            this._session = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

export default class KagiUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new KagiUsageIndicator(
            this.path,
            this._settings,
            () => this.openPreferences()
        );
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
