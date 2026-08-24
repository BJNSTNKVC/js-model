import { describe, expect, test } from 'vitest';
import { Attribute, Model } from '../src/main';

describe('Main', (): void => {
    test('exports Model class', (): void => {
        expect(Model).toBeDefined();
        expect(typeof Model).toBe('function');
    });

    test('exports Attribute class', (): void => {
        expect(Attribute).toBeDefined();
        expect(typeof Attribute).toBe('function');
    });

    test('exports individual modules', async (): Promise<void> => {
        const module = await import('../src/main');

        expect(module.Model).toBe(Model);
        expect(module.Attribute).toBe(Attribute);
    });
});
