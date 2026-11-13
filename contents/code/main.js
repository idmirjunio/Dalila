/*
    SPDX-FileCopyrightText: 2026 Usuário
    SPDX-License-Identifier: GPL-3.0-or-later
*/

/* Regras configuráveis para posicionar janelas na inicialização. */

const RULE_COUNT = 10;
const handledWindows = new Map();
const DEFAULT_RULES = [
    { match: "cadlkienfkclaiaibeoongdcgmdikeeg", monitor: 1, desktop: 0 },
    { match: "gemini;bard", monitor: 1, desktop: 0 },
    { match: "whatsapp", monitor: 1, desktop: 0 },
    { match: "ai.elementlabs.lmstudio;lm studio", monitor: 1, desktop: 2 },
    { match: "obsidian", monitor: 1, desktop: 4 }
];

function log(message) {
    print("[app-placement-rules] " + message);
}

function configuredRules() {
    var rules = [];
    for (var i = 1; i <= RULE_COUNT; i++) {
        var defaults = DEFAULT_RULES[i - 1] || { match: "", monitor: 0, desktop: 0 };
        rules.push({
            match: String(readConfig("rule" + i + "Match", defaults.match) || "").toLowerCase(),
            monitor: Number(readConfig("rule" + i + "Monitor", defaults.monitor)),
            desktop: Number(readConfig("rule" + i + "Desktop", defaults.desktop))
        });
    }
    return rules;
}

function matchingRule(window, rules) {
    var identity = [window.resourceClass, window.desktopFileName, window.caption]
        .filter(function (value) { return !!value; })
        .join(" ")
        .toLowerCase();

    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule.match) {
            continue;
        }
        var aliases = rule.match.split(";");
        for (var j = 0; j < aliases.length; j++) {
            var alias = aliases[j].trim();
            if (alias && identity.indexOf(alias) !== -1) {
                return { rule: rule, index: i + 1, alias: alias };
            }
        }
    }
    return null;
}

function findOutput(number, ruleIndex) {
    if (!number || number < 1) {
        return null;
    }
    var outputs = workspace.screens;
    if (number > outputs.length) {
        log("Regra " + ruleIndex + ": monitor " + number + " solicitado, mas só existem " + outputs.length + " monitor(es).");
        return null;
    }
    return outputs[number - 1];
}

function logMonitorMap() {
    var outputs = workspace.screens;
    log("Monitores disponíveis: " + outputs.length);
    for (var i = 0; i < outputs.length; i++) {
        log("  Monitor " + (i + 1) + " = " + outputs[i].name +
            " (fabricante=" + outputs[i].manufacturer + ", modelo=" + outputs[i].model + ")");
    }
}

function findDesktop(number) {
    if (!number || number < 1) {
        return null;
    }
    var desktops = workspace.desktops;
    if (!desktops) {
        return null;
    }
    for (var i = 0; i < desktops.length; i++) {
        if (desktops[i].x11DesktopNumber === number) {
            return desktops[i];
        }
    }
    return desktops.length >= number ? desktops[number - 1] : null;
}

function applyRule(window, matched) {
    var rule = matched.rule;
    var changed = false;

    if (rule.monitor > 0) {
        var output = findOutput(rule.monitor, matched.index);
        if (output) {
            if (window.output !== output) {
                workspace.sendClientToScreen(window, output);
                changed = true;
            }
        }
    }

    if (rule.desktop > 0) {
        var desktop = findDesktop(rule.desktop);
        if (desktop) {
            var current = window.desktops;
            if (window.onAllDesktops || !current || current.length !== 1 || current[0] !== desktop) {
                window.onAllDesktops = false;
                window.desktops = [desktop];
                changed = true;
            }
        } else {
            log("Regra " + matched.index + ": área de trabalho " + rule.desktop + " não existe.");
        }
    }

    log("Regra " + matched.index + " aplicada por '" + matched.alias + "' a " + window.caption +
        (changed ? "." : " (janela já estava no destino ou destinos indisponíveis)."));
}

function processWindow(window) {
    if (!window || !window.normalWindow || handledWindows.has(window)) {
        return;
    }

    var matched = matchingRule(window, configuredRules());
    if (!matched) {
        return;
    }

    handledWindows.set(window, true);
    window.closed.connect(function () {
        handledWindows.delete(window);
    });
    applyRule(window, matched);
}

function main() {
    if (typeof workspace === "undefined" ||
        typeof workspace.windowAdded === "undefined" ||
        typeof workspace.windowList !== "function" ||
        typeof workspace.sendClientToScreen !== "function" ||
        typeof workspace.screens === "undefined" ||
        typeof workspace.screensChanged === "undefined") {
        log("APIs necessárias do KWin indisponíveis; script não iniciado.");
        return;
    }

    var existing = workspace.windowList();
    for (var i = 0; i < existing.length; i++) {
        processWindow(existing[i]);
    }
    workspace.windowAdded.connect(processWindow);
    logMonitorMap();
    workspace.screensChanged.connect(logMonitorMap);
    log("Ativo; monitorando novas janelas conforme as regras configuradas.");
}

main();
