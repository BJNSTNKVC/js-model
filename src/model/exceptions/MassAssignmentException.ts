export class MassAssignmentException extends Error {
    /**
     * Create a new exception for an attribute that is not mass assignable.
     */
    constructor(message: string = 'Attribute is not mass assignable.') {
        super(message);

        this.name = 'MassAssignmentException';
    }
}
