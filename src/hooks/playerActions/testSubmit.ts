import type { SubmitActionRequest } from "../../submit/types";

/**
 * Test double for the ActionSubmitController's `submit`, for the automatic-action
 * hook tests: records every request and runs it at once, the way an idle
 * controller would, reporting the hash through onSuccess. A rejected run is
 * swallowed — surfacing it is the real controller's job, covered by its own tests.
 */
export function makeTestSubmit(): { submit: (request: SubmitActionRequest) => void; requests: SubmitActionRequest[] } {
    const requests: SubmitActionRequest[] = [];
    const submit = (request: SubmitActionRequest): void => {
        requests.push(request);
        void request
            .run()
            .then(result => request.onSuccess?.(result.hash))
            .catch(() => {});
    };
    return { submit, requests };
}
