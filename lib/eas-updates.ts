import * as Updates from "expo-updates";
import { useEffect } from "react";

export function useEasUpdateBootstrap(): void {
    useEffect(() => {
        if (__DEV__ || !Updates.isEnabled) {
            return;
        }

        let isMounted = true;

        Updates.checkForUpdateAsync()
            .then((result) => {
                if (!isMounted || !result.isAvailable) {
                    return undefined;
                }

                return Updates.fetchUpdateAsync().then(() => {
                    if (isMounted) {
                        return Updates.reloadAsync();
                    }
                    return undefined;
                });
            })
            .catch(() => undefined);

        return () => {
            isMounted = false;
        };
    }, []);
}
