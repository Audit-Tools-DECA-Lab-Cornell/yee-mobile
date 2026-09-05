/**
 * Guard tests for the domain colour palette - the mobile half.
 *
 * Mirrors `yee-frontend/tests/unit/domain-palette.spec.ts`. Between them they
 * make "one palette, two apps" an enforced property:
 *
 *   1. Every role clears the WCAG contrast floor it is used at, in both themes.
 *   2. The six chart fills stay distinguishable, including under CVD.
 *   3. The spec has not been edited without its checksum being refreshed (which
 *      is the prompt to make the same paired edit in yee-frontend), and no
 *      domain hex is hardcoded anywhere else in the app.
 *   4. The design system serves the spec's values unmodified.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
    DOMAIN_CONTRAST_FLOORS,
    DOMAIN_PALETTE_CHECKSUM,
    DOMAIN_SURFACES,
    domainPalette,
    domainPaletteOrder,
    type DomainMode,
} from "lib/domain-palette";
import { getDesignSystem } from "lib/design-system";

vi.mock("react-native", () => ({
    Appearance: {
        getColorScheme: () => "light",
        addChangeListener: () => ({ remove: () => undefined }),
    },
}));

const ROOT = resolve(__dirname, "../..");
const SPEC_PATH = resolve(ROOT, "lib/domain-palette.json");
const MODES: DomainMode[] = ["light", "dark"];

/* ── colour maths ─────────────────────────────────────────────────────────── */

const channels = (hex: string) =>
    [0, 2, 4].map((i) => Number.parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255);

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG 2.x contrast ratio. */
function contrast(a: string, b: string): number {
    const luminance = (hex: string) => {
        const [r, g, b2] = channels(hex).map(toLinear) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
    };
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
}

/** Machado–Oliveira–Fernandes (2009) CVD simulation at severity 1.0. */
const CVD_MATRICES = {
    protan: [
        [0.152286, 1.052583, -0.204868],
        [0.114503, 0.786281, 0.099216],
        [-0.003882, -0.048116, 1.051998],
    ],
    deutan: [
        [0.367322, 0.860646, -0.227968],
        [0.280085, 0.672501, 0.047413],
        [-0.01182, 0.04294, 0.968881],
    ],
} as const;

function oklabFromLinear([r, g, b]: readonly [number, number, number]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.79361778 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ] as const;
}

function linearOf(hex: string, kind?: keyof typeof CVD_MATRICES) {
    const [r, g, b] = channels(hex).map(toLinear) as [number, number, number];
    if (kind === undefined) return [r, g, b] as const;
    const m = CVD_MATRICES[kind];
    const clamp = (c: number) => Math.max(0, Math.min(1, c));
    return [
        clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b),
        clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b),
        clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b),
    ] as const;
}

/** Euclidean distance in OKLab ×100 - the separation metric the palette is tuned to. */
function deltaE(a: string, b: string, kind?: keyof typeof CVD_MATRICES): number {
    const [l1, a1, b1] = oklabFromLinear(linearOf(a, kind));
    const [l2, a2, b2] = oklabFromLinear(linearOf(b, kind));
    return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Stable, formatting-independent serialization of the spec: keys sorted, no
 * whitespace. The two repos format JSON differently, so the guard has to compare
 * CONTENT - a raw byte hash would fail on a formatter run while the colours were
 * still identical.
 */
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value as Record<string, unknown>)
                .sort()
                .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        );
    }
    return value;
}

/* ── tests ────────────────────────────────────────────────────────────────── */

describe.each(MODES)("domain palette - %s theme", (mode) => {
    const surfaces = DOMAIN_SURFACES[mode];

    it("keeps text and strong readable on the card, the app bg and their own tint", () => {
        for (const domain of domainPaletteOrder) {
            const colors = domainPalette[mode][domain];
            for (const role of ["text", "strong"] as const) {
                for (const against of [surfaces.card, surfaces.app, colors.light]) {
                    const ratio = contrast(colors[role], against);
                    expect(
                        ratio,
                        `${domain}.${role} (${colors[role]}) on ${against} = ${ratio.toFixed(2)}:1`,
                    ).toBeGreaterThanOrEqual(DOMAIN_CONTRAST_FLOORS[role]);
                }
            }
        }
    });

    it("keeps chart fills above WCAG 1.4.11 non-text contrast on the card", () => {
        for (const domain of domainPaletteOrder) {
            const { fill } = domainPalette[mode][domain];
            const ratio = contrast(fill, surfaces.card);
            expect(
                ratio,
                `${domain}.fill (${fill}) = ${ratio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(DOMAIN_CONTRAST_FLOORS.fill);
        }
    });

    it("keeps adjacent chart fills separable, including under CVD", () => {
        for (let i = 1; i < domainPaletteOrder.length; i++) {
            const previous = domainPalette[mode][domainPaletteOrder[i - 1]!].fill;
            const current = domainPalette[mode][domainPaletteOrder[i]!].fill;
            const pair = `${domainPaletteOrder[i - 1]} ↔ ${domainPaletteOrder[i]}`;
            expect(deltaE(previous, current), `${pair} (normal vision)`).toBeGreaterThanOrEqual(15);
            // Protanopia and deuteranopia are the gated pair; tritanopia is far rarer
            // and every domain mark here is directly labelled (WCAG 1.4.1).
            for (const kind of ["protan", "deutan"] as const) {
                expect(deltaE(previous, current, kind), `${pair} (${kind})`).toBeGreaterThanOrEqual(
                    8,
                );
            }
        }
    });

    it("serves the spec's values through the design system unmodified", () => {
        const { domains } = getDesignSystem(mode);
        for (const domain of domainPaletteOrder) {
            expect(domains[domain]).toEqual(domainPalette[mode][domain]);
        }
    });
});

describe("domain palette - cross-repo", () => {
    /**
     * What this catches: the spec being edited without the checksum being updated.
     * What it cannot catch on its own: this test reads only this repo's spec and
     * constant, so updating both together passes here regardless of what
     * yee-frontend holds. The pairing rests on DOMAIN_PALETTE_CHECKSUM being the
     * same literal in both repos and on both PRs landing together.
     */
    it("has not changed without its checksum being updated", () => {
        const digest = createHash("sha256")
            .update(JSON.stringify(canonical(JSON.parse(readFileSync(SPEC_PATH, "utf8")))))
            .digest("hex");
        expect(
            digest,
            "domain-palette.json changed. This must be a paired edit: copy its contents to " +
                "yee-frontend/src/styles/domain-palette.json, set DOMAIN_PALETTE_CHECKSUM to the " +
                "new digest in BOTH repos, regenerate the web's CSS tokens, and re-run the guard " +
                "tests on both sides. Nothing here can see yee-frontend, so landing only one side " +
                "will not fail this test.",
        ).toBe(DOMAIN_PALETTE_CHECKSUM);
    });

    it("has no domain colour hardcoded outside the spec", () => {
        const every = MODES.flatMap((mode) =>
            domainPaletteOrder.flatMap((domain) => Object.values(domainPalette[mode][domain])),
        ).map((hex) => hex.toLowerCase());

        const tracked = execFileSync("git", ["ls-files", "app", "components", "lib", "stores"], {
            cwd: ROOT,
            encoding: "utf8",
        })
            .split("\n")
            .filter((file) => file && !file.endsWith("domain-palette.json"));

        const offenders: string[] = [];
        for (const file of tracked) {
            const contents = readFileSync(resolve(ROOT, file), "utf8").toLowerCase();
            for (const hex of every) {
                if (contents.includes(hex)) offenders.push(`${file} contains ${hex}`);
            }
        }
        expect(
            offenders,
            "Domain colours must come from `designSystem.domains`, never be inlined.",
        ).toEqual([]);
    });
});
