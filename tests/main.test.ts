import { describe, expect, test } from 'vitest';
import { Attribute, BaseModel, MassAssignmentError, Model } from '../src/main';

describe('Main', (): void => {
    test('exports Model class', (): void => {
        expect(Model).toBeDefined();
        expect(typeof Model).toBe('function');
        expect(Model).toBe(BaseModel);
    });

    test('exports Attribute class', (): void => {
        expect(Attribute).toBeDefined();
        expect(typeof Attribute).toBe('function');
    });

    test('exports MassAssignmentError class', (): void => {
        expect(MassAssignmentError).toBeDefined();
        expect(typeof MassAssignmentError).toBe('function');
    });

    test('exports individual modules', async (): Promise<void> => {
        const module = await import('../src/main');

        expect(module.Model).toBe(Model);
        expect(module.BaseModel).toBe(BaseModel);
        expect(module.Attribute).toBe(Attribute);
        expect(module.MassAssignmentError).toBe(MassAssignmentError);
    });
});
