# Bank customer onboarding
Example of unit test mocking with Jest.

The system under test is a `CustomerOnboardingService` class that handles customer onboarding by checking the following:
1. The customer must not have previous sanctions
2. The customer must not be duplicated in the system
3. Customer address should be normalised

The following necessary classes and their corresponding functionalities do not exist, thus must be mocked:
- `SanctionsChecker`
- `AddressNormalizer`
- `Repo`
- `EventBus`

## Tools
Jest / JavaScript

## Author
ChatGPT 5, prompted by Arturo Mora-Rioja.