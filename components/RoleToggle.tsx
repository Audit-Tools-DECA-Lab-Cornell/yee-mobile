import { Button, XStack } from "tamagui";
import { ROLE_LABELS, type DemoRole } from "lib/yee-demo-data";
import { useDemoUiStore } from "stores/demo-ui-store";

/**
 * Role toggle used to preview manager and auditor UIs.
 */
export function RoleToggle() {
    const activeRole = useDemoUiStore((state) => state.activeRole);
    const setActiveRole = useDemoUiStore((state) => state.setActiveRole);

    return (
        <XStack
            borderWidth={1}
            borderColor="$borderColor"
            bg="$background"
            rounded="$6"
            p="$1.5"
            gap="$2"
            width="100%"
        >
            <RoleButton role="manager" activeRole={activeRole} onSelectRole={setActiveRole} />
            <RoleButton role="auditor" activeRole={activeRole} onSelectRole={setActiveRole} />
        </XStack>
    );
}

interface RoleButtonProps {
    readonly role: DemoRole;
    readonly activeRole: DemoRole;
    readonly onSelectRole: (role: DemoRole) => void;
}

/**
 * Individual role button with selected and unselected states.
 */
function RoleButton({ role, activeRole, onSelectRole }: RoleButtonProps) {
    const selected = role === activeRole;

    return (
        <Button
            flex={1}
            size="$3"
            rounded="$5"
            theme={selected ? "blue" : null}
            bg={selected ? "$blue9" : "$background"}
            borderWidth={selected ? 0 : 1}
            borderColor="$borderColor"
            onPress={() => {
                onSelectRole(role);
            }}
        >
            {ROLE_LABELS[role]}
        </Button>
    );
}
