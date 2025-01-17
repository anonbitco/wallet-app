import {
    BlockchainGenericClient,
    ChainIdType,
    IBlockInfo,
    TransactionMessageText,
    TransactionType,
    IBalance,
    IFeeOptions,
    Contracts
} from '../types';
import { networks } from './networks';
import { BigNumber } from 'bignumber.js';
import { config } from './config';
import abi from 'ethereumjs-abi';
import { Erc20Client } from './tokens/erc20-client';
import { TokenType } from '../types/token';
import { NameService } from './name-service';
import { ClientUtils } from './client-utils';
import { Ethereum } from '.';
import { fixEthAddress } from '../../utils/format-address';
import CONFIG from '../../../config';
import { HttpClient } from '../../utils/http-client';
import { captureException as SentryCaptureException } from '@sentry/react-native';
import { Staking } from './contracts/staking';
import { MethodSignature } from './types';
import { getContract } from './contracts/base-contract';

export class Client extends BlockchainGenericClient {
    constructor(chainId: ChainIdType) {
        super(chainId, networks);
        this.tokens[TokenType.ERC20] = new Erc20Client(this);
        this.nameService = new NameService(this);
        this.utils = new ClientUtils(this);
        this.contracts[Contracts.STAKING] = new Staking(this);
    }

    public getBalance(address: string): Promise<IBalance> {
        return this.http.jsonRpc('eth_getBalance', [fixEthAddress(address), 'latest']).then(res => {
            return {
                total: new BigNumber(res.result, 16),
                available: new BigNumber(res.result, 16)
            };
        });
    }

    public getNonce(address: string): Promise<number> {
        return this.http
            .jsonRpc('eth_getTransactionCount', [fixEthAddress(address), 'latest'])
            .then(res => {
                return new BigNumber(res.result, 16).toNumber();
            });
    }

    public sendTransaction(transaction): Promise<{ txHash: string; rawResponse: any }> {
        return this.http.jsonRpc('eth_sendRawTransaction', [transaction]).then(res => {
            if (res.result) {
                return {
                    txHash: res.result,
                    rawResponse: res
                };
            }

            const errorMessage: string = res.error.message;
            if (errorMessage.includes('transaction underpriced')) {
                return Promise.reject(TransactionMessageText.TR_UNDERPRICED);
            }
            if (errorMessage.includes('insufficient funds for gas')) {
                return Promise.reject(TransactionMessageText.NOT_ENOUGH_TOKENS);
            }
        });
    }

    public getCurrentBlock(): Promise<IBlockInfo> {
        return this.http.jsonRpc('eth_blockNumber').then(res => {
            return {
                number: new BigNumber(res.result, 16).toNumber()
            };
        });
    }

    public async callContract(contractAddress, methodSignature, params: any[] = []) {
        const signature = methodSignature.split(':');
        const method = signature[0];
        let returnTypes = [];
        if (signature[1]) {
            returnTypes = signature[1]
                .replace('(', '')
                .replace(')', '')
                .split(',')
                .filter(Boolean)
                .map(t => t.trim());
        }

        const response = await this.http.jsonRpc('eth_call', [
            {
                to: contractAddress,
                data: '0x' + abi.simpleEncode(method, ...params).toString('hex')
            },
            'latest'
        ]);

        const dataBuffer = Buffer.from(response.result.replace('0x', ''), 'hex');

        const result = abi.rawDecode(returnTypes, dataBuffer);

        if (result.length === 1) {
            return result.toString();
        } else {
            return result.map(r => r.toString());
        }
    }

    public async getFees(
        transactionType: TransactionType,
        data: {
            from?: string;
            to?: string;
            amount?: string;
            contractAddress?: string;
            raw?: string;
        },
        tokenType: TokenType = TokenType.NATIVE
    ): Promise<IFeeOptions> {
        try {
            let results = {};
            switch (transactionType) {
                case TransactionType.TRANSFER: {
                    results = data.contractAddress
                        ? await this.estimateGas(
                              data.from,
                              data.to,
                              data.contractAddress,
                              new BigNumber(data.amount),
                              '0x' +
                                  abi
                                      .simpleEncode(
                                          MethodSignature.TRANSFER,
                                          data.to,
                                          new BigNumber(data.amount).toFixed()
                                      )
                                      .toString('hex')
                          )
                        : await this.estimateGas(data.from, data.to);
                }
                case TransactionType.CONTRACT_CALL: {
                    results = await this.estimateGas(
                        data.from,
                        data.to,
                        data.contractAddress,
                        new BigNumber(data.amount),
                        data.raw
                    );
                }
            }
            let presets: {
                standard: BigNumber;
                fast: BigNumber;
                fastest: BigNumber;
            };

            if (results[1]) {
                const response = results[1];

                // Need to divide by 10 the response from ethgasAPI.json
                // Note: To convert the provided values to gwei, divide by 10

                if (response && response.result) {
                    presets = {
                        standard: Ethereum.account.convertUnit(
                            new BigNumber(response.result.data.average),
                            config.feeOptions.ui.gasPriceUnit,
                            config.defaultUnit
                        ),
                        fast: Ethereum.account.convertUnit(
                            new BigNumber(response.result.data.fast),
                            config.feeOptions.ui.gasPriceUnit,
                            config.defaultUnit
                        ),
                        fastest: Ethereum.account.convertUnit(
                            new BigNumber(response.result.data.fastest),
                            config.feeOptions.ui.gasPriceUnit,
                            config.defaultUnit
                        )
                    };
                } else {
                    SentryCaptureException(
                        new Error(
                            JSON.stringify({
                                event: 'getEstimated Fees - no response - defaults Set'
                            })
                        )
                    );
                }
            }

            const contractAddressStaking = await getContract(this.chainId, Contracts.STAKING);

            const gasPrice = presets?.standard || config.feeOptions.defaults.gasPrice;
            let gasLimit =
                results[0] && results[0].result
                    ? new BigNumber(parseInt(results[0].result, 16))
                    : config.feeOptions.defaults.gasLimit[tokenType];

            // TODO - find a way to get the exact gaslimit for GRT staking
            if (
                data.contractAddress &&
                data.contractAddress.toLowerCase() === contractAddressStaking.toLowerCase()
            ) {
                gasLimit = config.feeOptions.defaults.gasLimit[tokenType];
            }

            return {
                gasPrice: gasPrice.toString(),
                gasLimit: gasLimit.toString(),
                presets: presets ? presets : config.feeOptions.defaults.gasPricePresets,
                feeTotal: gasPrice.multipliedBy(gasLimit).toString(),
                responseHasDefaults: presets ? false : true
            };
        } catch (error) {
            const gasPrice = config.feeOptions.defaults.gasPrice;
            const gasLimit = config.feeOptions.defaults.gasLimit[tokenType];

            SentryCaptureException(
                new Error(JSON.stringify({ event: 'getEstimated Fees - defaults Set', error }))
            );

            return {
                gasPrice: gasPrice.toString(),
                gasLimit: gasLimit.toString(),
                presets: config.feeOptions.defaults.gasPricePresets,
                feeTotal: gasPrice.multipliedBy(gasLimit).toString(),
                responseHasDefaults: true
            };
        }
    }

    public async estimateGas(
        from: string,
        to: string,
        contractAddress?: string,
        amount?: BigNumber,
        data?: string
    ): Promise<any> {
        let gasEstimatePromise;
        if (contractAddress) {
            let params;

            params = {
                from,
                to: contractAddress
            };

            if (data) {
                params = {
                    ...params,
                    data
                };
            }

            gasEstimatePromise = this.http
                .jsonRpc('eth_estimateGas', [{ params }, 'latest'])
                .then(res => {
                    if (res.result) {
                        res.result =
                            '0x' + new BigNumber(res.result, 16).multipliedBy(1.3).toString(16);
                        return res;
                    }
                });
        } else {
            gasEstimatePromise = this.http.jsonRpc('eth_estimateGas', [{ from, to }]);
        }

        return Promise.all([
            gasEstimatePromise,
            new HttpClient(CONFIG.walletApiBaseUrl).get('/blockchain/ethereum/gas-prices')
        ]);
    }

    public async getMinimumAmountDelegate(): Promise<BigNumber> {
        return new BigNumber(0);
    }
}
