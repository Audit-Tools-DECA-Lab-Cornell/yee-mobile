import { memo } from "react";
import { Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import type { MobileYeeDomainKey } from "lib/yee-mobile-audit-config";

/**
 * The two shapes a domain takes outside the audit wizard - the report screen
 * above all, where there is no `SurveyDomainContext` to read from because the
 * screen shows all six domains at once.
 *
 * Colour alone never carries the meaning: both shapes sit with the domain's
 * name, which is what WCAG 1.4.1 asks for. The label uses the domain's `text`
 * step (>= 7:1 on the card) rather than `strong`, which is tuned for borders.
 *
 * These mirror `DomainDot` / `DomainLabel` in yee-frontend, so a domain reads
 * the same on both clients.
 */

/** A small filled dot, for use immediately before a domain's name. */
export const DomainDot = memo(function DomainDot({
    domain,
    size = 10,
}: {
    domain: MobileYeeDomainKey;
    size?: number;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            width={size}
            height={size}
            rounded={designSystem.radii.full}
            style={{ backgroundColor: designSystem.domains[domain].strong }}
            accessibilityElementsHidden
            importantForAccessibility="no"
        />
    );
});

/** A domain's name in its own colour, preceded by the dot. */
export const DomainLabel = memo(function DomainLabel({
    domain,
    label,
    fontSize = 15,
}: {
    domain: MobileYeeDomainKey;
    label: string;
    fontSize?: number;
}) {
    const designSystem = useDesignSystem();
    return (
        <XStack items="center" gap="$1.5">
            <DomainDot domain={domain} />
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={fontSize}
                style={{ color: designSystem.domains[domain].text }}
            >
                {label}
            </Text>
        </XStack>
    );
});
