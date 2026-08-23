export class MassAssignmentError extends Error {
    /**
     * Identify the error class in stack traces and name checks.
     */
    override name: string = 'MassAssignmentError';
}
