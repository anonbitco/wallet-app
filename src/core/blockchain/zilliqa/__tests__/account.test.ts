import { Zilliqa } from '../';
import { Blockchain } from '../../types';
import {
    getPubKeyFromPrivateKey,
    getAddressFromPrivateKey,
    getAddressFromPublicKey
} from '@zilliqa-js/crypto/dist/util'; // import like this to optimize imports
import { toBech32Address } from '@zilliqa-js/crypto/dist/bech32';
import { isBech32 } from '@zilliqa-js/util/dist/validation';

jest.mock('@zilliqa-js/crypto/dist/util', () => ({
    getPubKeyFromPrivateKey: jest.fn().mockReturnValue('PUBLIC_KEY'),
    getAddressFromPrivateKey: jest.fn().mockReturnValue('address'),
    getAddressFromPublicKey: jest.fn().mockReturnValue('address')
}));

jest.mock('@zilliqa-js/util/dist/validation', () => ({
    isBech32: jest.fn().mockReturnValue(true)
}));

jest.mock('@zilliqa-js/crypto/dist/bech32', () => ({
    toBech32Address: jest.fn().mockReturnValue('BECH32_ADDRESS')
}));

const clearMocks = () => {
    // @ts-ignore
    getPubKeyFromPrivateKey.mockClear();
    // @ts-ignore
    getAddressFromPrivateKey.mockClear();
    // @ts-ignore
    getAddressFromPublicKey.mockClear();
    // @ts-ignore
    toBech32Address.mockClear();
    // @ts-ignore
    isBech32.mockClear();
};

describe('Ethereum account', () => {
    beforeEach(() => {
        clearMocks();
    });

    test('isValidChecksumAddress()', () => {
        expect(Zilliqa.account.isValidChecksumAddress('ADDRESS')).toBe(true);
        expect(isBech32).toBeCalledWith('ADDRESS');
    });

    test('isValidAddress()', () => {
        expect(Zilliqa.account.isValidAddress('ADDRESS')).toBe(true);
        expect(isBech32).toBeCalledWith('ADDRESS');
    });

    test('publicToAddress()', () => {
        expect(Zilliqa.account.publicToAddress('PUBLIC_KEY')).toBe('BECH32_ADDRESS');
        expect(getAddressFromPublicKey).toBeCalledWith('PUBLIC_KEY');
        expect(toBech32Address).toBeCalledWith('address');
    });

    test('privateToPublic()', () => {
        expect(Zilliqa.account.privateToPublic('PRIVATE_KEY')).toBe('PUBLIC_KEY');
        expect(getPubKeyFromPrivateKey).toBeCalledWith('PRIVATE_KEY');
    });

    test('privateToAddress()', () => {
        expect(Zilliqa.account.privateToAddress('PRIVATE_KEY')).toBe('BECH32_ADDRESS');
        expect(getAddressFromPrivateKey).toBeCalledWith('PRIVATE_KEY');
        expect(toBech32Address).toBeCalledWith('address');
    });

    test('getAccountFromPrivateKey()', () => {
        // valid private key
        const result = Zilliqa.account.getAccountFromPrivateKey('PRIVATE_KEY', 1);
        expect(getPubKeyFromPrivateKey).toBeCalledWith('PRIVATE_KEY');
        expect(getAddressFromPrivateKey).toBeCalledWith('PRIVATE_KEY');
        expect(toBech32Address).toBeCalledWith('address');

        expect(result).toEqual({
            index: 1,
            blockchain: Blockchain.ZILLIQA,
            address: 'BECH32_ADDRESS',
            publicKey: 'PUBLIC_KEY'
        });

        // TODO: test with invalid privatekey, without mocks
    });
});