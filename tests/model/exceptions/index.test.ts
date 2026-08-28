import { describe, expect, test } from 'vitest';
import { MassAssignmentException } from '../../../src/model/exceptions';

describe('Exceptions', (): void => {
    test('exports every exception class', (): void => {
        expect(typeof MassAssignmentException).toBe('function');
    });

    test('exports individual modules', async (): Promise<void> => {
        const module = await import('../../../src/model/exceptions');

        expect(module.MassAssignmentException).toBe(MassAssignmentException);
    });
});
