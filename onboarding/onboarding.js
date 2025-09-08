// Dependency interfaces as classes (instances will be passed in tests)
export class SanctionsChecker {
    has_hit(name, dob) {
        throw new Error('Not implemented');
    }
}

export class AddressNormalizer {
    normalize(address) {
        throw new Error('Not implemented');
    }
}

export class Repo {
    find_by_national_id(national_id) {
        throw new Error('Not implemented');
    }
    create(data) {
        throw new Error('Not implemented');
    }
}

export class EventBus {
    publish(topic, payload) {
        throw new Error('Not implemented');
    }
}

export class CustomerOnboardingService {
    /**
     * @param {SanctionsChecker} sanctions_checker
     * @param {AddressNormalizer} address_normalizer
     * @param {Repo} repo
     * @param {EventBus} event_bus
     */
    constructor(sanctions_checker, address_normalizer, repo, event_bus) {
        this.sanctions_checker = sanctions_checker;
        this.address_normalizer = address_normalizer;
        this.repo = repo;
        this.event_bus = event_bus;
    }

    /**
     * @param {{name:string, dob:string, national_id:string, address:string}} customer
     * @returns {{status:'rejected'|'duplicate'|'created', customer_id?:number}}
     */
    onboard(customer) {
        // 1) Compliance gate: sanctions
        if (this.sanctions_checker.has_hit(customer.name, customer.dob)) {
            this.event_bus.publish('onboarding_rejected', {
                reason: 'sanctions_hit',
                national_id: customer.national_id,
            });
            return { status: 'rejected' };
        }

        // 2) Deduplication
        const existing = this.repo.find_by_national_id(customer.national_id);
        if (existing) {
            this.event_bus.publish('onboarding_duplicate', {
                national_id: customer.national_id,
            });
            return { status: 'duplicate' };
        }

        // 3) Normalize address (best-effort)
        let normalized_address;
        try {
            normalized_address = this.address_normalizer.normalize(customer.address);
        } catch (e) {
            normalized_address = customer.address; // fall back
        }

        const saved_id = this.repo.create({
            name: customer.name,
            dob: customer.dob,
            national_id: customer.national_id,
            address: normalized_address,
        });

        this.event_bus.publish('onboarding_completed', { customer_id: saved_id });
        return { status: 'created', customer_id: saved_id };
    }
}