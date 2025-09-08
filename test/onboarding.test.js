import { jest, describe, test, expect } from '@jest/globals';
import {
    SanctionsChecker,
    AddressNormalizer,
    Repo,
    EventBus,
    CustomerOnboardingService,
} from '../onboarding/onboarding.js';

function makeCustomer() {
    return {
        name: 'Simone L. Laursen',
        dob: '1968-12-15',
        national_id: '1512680824',
        address: 'Pilekrogen 49, 1451 København K',
    };
}

//
// Positive tests
//
describe('Positive tests', () => {
    test('normalizes address and creates', () => {
        // Arrange
        const c = makeCustomer();

        const sanctions = new SanctionsChecker();
        sanctions.has_hit = jest.fn().mockReturnValue(false);

        const normalizer = new AddressNormalizer();
        normalizer.normalize = jest.fn().mockReturnValue('Pilekrogen 49, 1451 København K (N)');

        const repo = new Repo();
        repo.find_by_national_id = jest.fn().mockReturnValue(null);
        repo.create = jest.fn().mockReturnValue(42);

        const events = new EventBus();
        events.publish = jest.fn();

        // Arrange/Act
        const svc = new CustomerOnboardingService(sanctions, normalizer, repo, events);
        const out = svc.onboard(c);

        // Assert
        expect(out).toEqual({ status: 'created', customer_id: 42 });
        expect(normalizer.normalize).toHaveBeenCalledTimes(1);
        expect(normalizer.normalize).toHaveBeenCalledWith(c.address);

        const savedPayload = repo.create.mock.calls[0][0];
        expect(savedPayload).toEqual({
            name: c.name,
            dob: c.dob,
            national_id: c.national_id,
            address: 'Pilekrogen 49, 1451 København K (N)',
        });

        expect(events.publish).toHaveBeenCalledWith('onboarding_completed', { customer_id: 42 });
    });

    test('falls back when normalizer fails', () => {
        // Arrange
        const c = makeCustomer();

        const sanctions = new SanctionsChecker();
        sanctions.has_hit = jest.fn().mockReturnValue(false);

        const normalizer = new AddressNormalizer();
        normalizer.normalize = jest.fn(() => {
            throw new Error('API down');
        });

        const repo = new Repo();
        repo.find_by_national_id = jest.fn().mockReturnValue(null);
        repo.create = jest.fn().mockReturnValue(99);

        const events = new EventBus();
        events.publish = jest.fn();

        // Arrange/Act
        const svc = new CustomerOnboardingService(sanctions, normalizer, repo, events);
        const out = svc.onboard(c);

        // Assert
        expect(out.status).toBe('created');
        const savedPayload = repo.create.mock.calls[0][0];
        expect(savedPayload.address).toBe(c.address);
        expect(events.publish).toHaveBeenCalledWith('onboarding_completed', { customer_id: 99 });
    });
});

//
// Negative tests 
//
describe('Negative tests', () => {
    test('rejects on sanctions hit', () => {
        // Arrange
        const c = makeCustomer();

        const sanctions = new SanctionsChecker();
        sanctions.has_hit = jest.fn().mockReturnValue(true);

        const normalizer = new AddressNormalizer();
        normalizer.normalize = jest.fn();

        const repo = new Repo();
        repo.find_by_national_id = jest.fn();
        repo.create = jest.fn();

        const events = new EventBus();
        events.publish = jest.fn();

        // Arrange/Act
        const svc = new CustomerOnboardingService(sanctions, normalizer, repo, events);
        const out = svc.onboard(c);

        // Assert
        expect(out).toEqual({ status: 'rejected' });
        expect(repo.find_by_national_id).not.toHaveBeenCalled();
        expect(repo.create).not.toHaveBeenCalled();
        expect(normalizer.normalize).not.toHaveBeenCalled();
        expect(events.publish).toHaveBeenCalledWith('onboarding_rejected', {
            reason: 'sanctions_hit',
            national_id: '1512680824',
        });
    });

    test('detects duplicate and skips creation', () => {
        // Arrange
        const c = makeCustomer();

        const sanctions = new SanctionsChecker();
        sanctions.has_hit = jest.fn().mockReturnValue(false);

        const normalizer = new AddressNormalizer();
        normalizer.normalize = jest.fn();

        const repo = new Repo();
        repo.find_by_national_id = jest.fn().mockReturnValue({ id: 7, national_id: '1512680824' });
        repo.create = jest.fn();

        const events = new EventBus();
        events.publish = jest.fn();

        // Arrange/Act
        const svc = new CustomerOnboardingService(sanctions, normalizer, repo, events);
        const out = svc.onboard(c);

        // Assert
        expect(out).toEqual({ status: 'duplicate' });
        expect(repo.create).not.toHaveBeenCalled();
        expect(normalizer.normalize).not.toHaveBeenCalled();
        expect(events.publish).toHaveBeenCalledWith('onboarding_duplicate', {
            national_id: '1512680824',
        });
    });
});