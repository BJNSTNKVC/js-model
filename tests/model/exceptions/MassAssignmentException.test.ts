import { describe, expect, test } from 'vitest';
import { MassAssignmentException } from '../../../src/main';

describe('MassAssignmentException', (): void => {
    test('carries a default message', (): void => {
        const exception: MassAssignmentException = new MassAssignmentException();

        expect(exception).toBeInstanceOf(Error);
        expect(exception.name).toEqual('MassAssignmentException');
        expect(exception.message).toEqual('Attribute is not mass assignable.');
    });

    test('accepts a custom message', (): void => {
        expect(new MassAssignmentException('Add [id] to the fillable list to enable mass assignment on [User].').message).toEqual('Add [id] to the fillable list to enable mass assignment on [User].');
    });
});
