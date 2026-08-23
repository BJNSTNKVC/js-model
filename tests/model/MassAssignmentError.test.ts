import { describe, expect, test } from 'vitest';
import { MassAssignmentError } from '../../src/main';

describe('MassAssignmentError', (): void => {
    test('identifies itself by name', (): void => {
        const error: MassAssignmentError = new MassAssignmentError('Add [id] to the fillable list to enable mass assignment on [User].');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toEqual('MassAssignmentError');
        expect(error.message).toEqual('Add [id] to the fillable list to enable mass assignment on [User].');
    });
});
