import React from 'react';
import { View, Platform } from 'react-native';
import { IReduxState } from '../../redux/state';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../core/theme/with-theme';
import { smartConnect } from '../../core/utils/smart-connect';
import { connect } from 'react-redux';
import { Text, Button } from '../../library';
import { translate } from '../../core/i18n';
import { getBlockchain } from '../../core/blockchain/blockchain-factory';
import { withNavigationParams, INavigationProps } from '../../navigation/with-navigation-params';
import { sendTransferTransaction, addPublishedTxToAccount } from '../../redux/wallets/actions';
import { getAccount, getSelectedAccount, getSelectedWallet } from '../../redux/wallets/selectors';
import { formatAddress } from '../../core/utils/format-address';
import {
    Blockchain,
    IFeeOptions,
    ChainIdType,
    TransactionMessageText,
    TransactionMessageType,
    IBlockchainTransaction,
    TransactionType
} from '../../core/blockchain/types';
import { HeaderLeftClose } from '../../components/header-left-close/header-left-close';
import { FeeOptions } from './components/fee-options/fee-options';
import BigNumber from 'bignumber.js';
import { BASE_DIMENSION } from '../../styles/dimensions';
import { IAccountState, ITokenState, IWalletState } from '../../redux/wallets/state';
import { formatNumber } from '../../core/utils/format-number';
import { openBottomSheet } from '../../redux/ui/bottomSheet/actions';
import { TestnetBadge } from '../../components/testnet-badge/testnet-badge';
import { getChainId } from '../../redux/preferences/selectors';
import { Memo } from './components/extra-fields/memo/memo';
import { HeaderStepByStep } from './components/header-step-by-step/header-step-by-step';
import { EnterAmount } from './components/enter-amount/enter-amount';
import { Amount } from '../../components/amount/amount';
import findIndex from 'lodash/findIndex';
import { AddAddress } from './components/add-address/add-address';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { getTokenConfig } from '../../redux/tokens/static-selectors';
import { ConnectExtension } from '../../core/connect-extension/connect-extension';
import { NotificationType } from '../../core/messaging/types';
import { ConnectExtensionWeb } from '../../core/connect-extension/connect-extension-web';
import { NavigationService } from '../../navigation/navigation-service';
import { LoadingModal } from '../../components/loading-modal/loading-modal';
import { BottomCta } from '../../components/bottom-cta/bottom-cta';
import { PrimaryCtaField } from '../../components/bottom-cta/primary-cta-field/primary-cta-field';
import { AmountCtaField } from '../../components/bottom-cta/amount-cta-field/amount-cta-field';
import {
    getInputAmountToStd,
    availableFunds,
    availableAmount
} from '../../core/utils/available-funds';
import { TokenType } from '../../core/blockchain/types/token';
import { LoadingIndicator } from '../../components/loading-indicator/loading-indicator';
import { Client as SolanaClient } from '../../core/blockchain/solana/client';
import {
    addBreadcrumb as SentryAddBreadcrumb,
    captureException as SentryCaptureException
} from '@sentry/react-native';

interface IHeaderStep {
    step: number;
    title: string;
    active: boolean;
}

export interface IReduxProps {
    account: IAccountState;
    sendTransferTransaction: typeof sendTransferTransaction;
    openBottomSheet: typeof openBottomSheet;
    selectedWallet: IWalletState;
    selectedAccount: IAccountState;
    chainId: ChainIdType;
    addPublishedTxToAccount: typeof addPublishedTxToAccount;
}

export const mapStateToProps = (state: IReduxState, ownProps: INavigationParams) => {
    return {
        account: getAccount(state, ownProps.accountIndex, ownProps.blockchain),
        selectedWallet: getSelectedWallet(state),
        selectedAccount: getSelectedAccount(state),
        chainId: getChainId(state, ownProps.blockchain)
    };
};

const mapDispatchToProps = {
    sendTransferTransaction,
    openBottomSheet,
    addPublishedTxToAccount
};

export interface INavigationParams {
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
}

interface IState {
    toAddress: string;
    resolvedAddress: string;
    amount: string;
    insufficientFunds: boolean;
    feeOptions: IFeeOptions;
    showExtensionMessage: boolean;
    memo: string;
    headerSteps: IHeaderStep[];
    insufficientFundsFees: boolean;
    availableAmount: string;
    isLoading: boolean;
    splActiveToken: boolean;
}

export const navigationOptions = ({ navigation }: any) => ({
    headerLeft: () => <HeaderLeftClose navigation={navigation} />,
    title: translate('App.labels.send')
});

export class SendScreenComponent extends React.Component<
    INavigationProps<INavigationParams> &
        IReduxProps &
        IThemeProps<ReturnType<typeof stylesProvider>>,
    IState
> {
    public static navigationOptions = navigationOptions;

    constructor(
        props: INavigationProps<INavigationParams> &
            IReduxProps &
            IThemeProps<ReturnType<typeof stylesProvider>>
    ) {
        super(props);

        this.state = {
            resolvedAddress: '',
            toAddress: '',
            amount: '',
            insufficientFunds: false,
            feeOptions: undefined,
            showExtensionMessage: false,
            memo: '',
            headerSteps: [
                { step: 1, title: translate('Send.addAddress'), active: true },
                { step: 2, title: translate('App.labels.enterAmount'), active: false },
                { step: 3, title: translate('Send.confirmTransaction'), active: false }
            ],
            insufficientFundsFees: false,
            availableAmount: '0',
            isLoading: false,
            splActiveToken: false
        };
    }

    public async componentDidMount() {
        this.calculateAvailableAmount();
    }

    private async calculateAvailableAmount() {
        const amount = await availableAmount(
            this.props.account,
            this.props.token,
            this.props.chainId,
            { feeOptions: this.state.feeOptions }
        );

        this.setState({ availableAmount: amount });
    }

    public async confirmPayment() {
        if (Platform.OS === 'web') {
            await LoadingModal.open({
                text: TransactionMessageText.WAITING_TX_CONFIRM,
                type: TransactionMessageType.INFO
            });

            const account = this.props.account;
            const token = this.props.token;
            const tokenConfig = getTokenConfig(account.blockchain, token.symbol);

            const blockchainInstance = getBlockchain(account.blockchain);

            const formattedAmount = formatNumber(new BigNumber(this.state.amount), {
                currency: token.symbol
            });

            const formattedAddress = formatAddress(
                this.props.account.address,
                this.props.account.blockchain
            );

            const tx = await blockchainInstance.transaction.buildTransferTransaction({
                account,
                chainId: this.props.chainId,
                toAddress: this.state.toAddress,
                amount: blockchainInstance.account
                    .amountToStd(this.state.amount, tokenConfig.decimals)
                    .toFixed(0, BigNumber.ROUND_DOWN),
                token: token.symbol,
                feeOptions: this.state.feeOptions,
                extraFields: { memo: this.state.memo }
            });

            tx.walletPubKey = this.props.selectedWallet.walletPublicKey;

            // add type to this
            const sendRequestPayload = {
                method: NotificationType.MOONLET_TRANSACTION,
                params: [tx],
                notification: {
                    title: translate('Notifications.extensionTx.title'),
                    body: translate('Notifications.extensionTx.body', {
                        formattedAmount,
                        formattedAddress
                    })
                }
            };

            try {
                const sendRequestRes = await ConnectExtension.sendRequest(sendRequestPayload);

                if (sendRequestRes?.success) {
                    await LoadingModal.open({
                        type: TransactionMessageType.COMPONENT,
                        component: (
                            <View style={this.props.styles.loadingModalContainer}>
                                <Text style={this.props.styles.loadingModalMessage}>
                                    {translate(
                                        'LoadingModal.' +
                                            TransactionMessageText.WAITING_TX_CONFIRM_CANCEL,
                                        { app: this.props.blockchain }
                                    )}
                                </Text>
                                <Button
                                    onPress={async () => {
                                        await LoadingModal.close();

                                        try {
                                            await ConnectExtension.deleteRequest(
                                                sendRequestRes.data.requestId
                                            );
                                        } catch {
                                            //
                                        }
                                    }}
                                >
                                    {translate('App.labels.cancel')}
                                </Button>
                            </View>
                        )
                    });

                    ConnectExtensionWeb.listenerReqResponse(
                        sendRequestRes.data.requestId,
                        async (res: {
                            result: { txHash: string; tx: IBlockchainTransaction };
                            errorCode: string;
                        }) => {
                            if (res.errorCode) {
                                await LoadingModal.close();
                            } else if (res.result?.txHash && res.result?.tx) {
                                this.props.addPublishedTxToAccount(
                                    res.result.txHash,
                                    res.result.tx,
                                    this.props.selectedWallet.id
                                );

                                await LoadingModal.close();
                                NavigationService.goBack();
                            } else {
                                // error
                            }
                        }
                    );
                }
            } catch {
                // show error message to the user
                await LoadingModal.close();
            }

            return;
        } else {
            // Mobile App

            this.props.sendTransferTransaction(
                this.props.account,
                this.state.toAddress,
                this.state.amount,
                this.props.token.symbol,
                this.state.feeOptions,
                this.props.navigation,
                { memo: this.state.memo }
            );
        }
    }

    public onFeesChanged(feeOptions: IFeeOptions) {
        this.setState({ feeOptions }, () => {
            this.calculateAvailableAmount();

            const { insufficientFunds, insufficientFundsFees } = availableFunds(
                this.state.amount,
                this.props.account,
                this.props.token,
                this.props.chainId,
                feeOptions
            );

            this.setState({ insufficientFunds, insufficientFundsFees });
        });
    }

    public onMemoInput(memo: string) {
        this.setState({ memo });
    }

    public addAmount(value: string) {
        const amount = value.replace(/,/g, '.');
        this.setState({ amount }, () => {
            const { insufficientFunds, insufficientFundsFees } = availableFunds(
                amount,
                this.props.account,
                this.props.token,
                this.props.chainId,
                this.state.feeOptions
            );

            this.setState({ insufficientFunds, insufficientFundsFees });
        });
    }

    public renderExtraFields(value: string) {
        switch (value) {
            case 'Memo':
                return <Memo key={value} onMemoInput={(memo: string) => this.onMemoInput(memo)} />;

            default:
                return null;
        }
    }

    private renderAddAddressContainer() {
        return (
            <AddAddress
                key="AddAddressContainer"
                account={this.props.account}
                blockchain={this.props.blockchain}
                chainId={this.props.chainId}
                onChange={(toAddress: string, resolvedAddress?: string) =>
                    this.setState({ toAddress, resolvedAddress })
                }
            />
        );
    }

    private async checkSplTokenActive() {
        this.setState({ isLoading: true });

        const { blockchain } = this.props.account;
        const tokenConfig = getTokenConfig(blockchain, this.props.token.symbol);
        const mint = tokenConfig.contractAddress;

        try {
            const client = getBlockchain(blockchain).getClient(this.props.chainId) as SolanaClient;

            const splActiveToken = await client.isActiveToken(
                mint,
                this.state.toAddress,
                TokenType.SPL
            );

            this.setState({ splActiveToken });
        } catch (error) {
            SentryAddBreadcrumb({
                message: JSON.stringify({
                    data: {
                        token: this.props.token.symbol,
                        mint,
                        toAddress: this.state.toAddress
                    },
                    error
                })
            });

            SentryCaptureException(
                new Error(`Cannot get spl active token, ${tokenConfig.symbol}, ${error?.message}`)
            );
        }

        this.setState({ isLoading: false });
    }

    private renderBottomConfirm() {
        const { resolvedAddress } = this.state;
        const { blockchain } = this.props.account;

        const activeIndex = findIndex(this.state.headerSteps, ['active', true]);
        const tokenConfig = getTokenConfig(blockchain, this.props.token.symbol);

        let disableButton: boolean;
        switch (activeIndex) {
            case 0:
                // Add address
                if (this.state.toAddress === '') disableButton = true;
                break;
            case 1:
                // Enter amount
                if (
                    this.state.amount === '' ||
                    this.state.insufficientFunds ||
                    this.state.insufficientFundsFees ||
                    isNaN(Number(this.state.feeOptions?.gasLimit)) === true ||
                    isNaN(Number(this.state.feeOptions?.gasPrice))
                )
                    disableButton = true;
                break;
            case 2:
                // Confirm transaction
                disableButton = false;
                break;
            default:
                disableButton = true;
                break;
        }

        return (
            <BottomCta
                label={
                    activeIndex === this.state.headerSteps.length - 1
                        ? translate('App.labels.confirm')
                        : translate('App.labels.next')
                }
                disabled={disableButton}
                onPress={() => {
                    if (activeIndex === 2) {
                        this.confirmPayment();
                    } else {
                        const steps = this.state.headerSteps;

                        steps[activeIndex].active = false;
                        steps[activeIndex + 1].active = true;

                        this.setState({ headerSteps: steps });
                    }

                    const tokenInfo = getTokenConfig(
                        this.props.account.blockchain,
                        this.props.token.symbol
                    );

                    if (
                        blockchain === Blockchain.SOLANA &&
                        tokenInfo.type === TokenType.SPL &&
                        activeIndex === 1
                    ) {
                        this.checkSplTokenActive();
                    }
                }}
            >
                <PrimaryCtaField
                    label={translate('App.labels.send')}
                    action={translate('App.labels.to')}
                    value={formatAddress(
                        resolvedAddress ? resolvedAddress : this.state.toAddress,
                        this.props.account.blockchain
                    )}
                />
                {(activeIndex === 1 || activeIndex === 2) && (
                    <AmountCtaField
                        tokenConfig={tokenConfig}
                        stdAmount={getInputAmountToStd(
                            this.props.account,
                            this.props.token,
                            this.state.amount
                        )}
                        account={this.props.account}
                    />
                )}
            </BottomCta>
        );
    }

    private renderEnterAmount() {
        const config = getBlockchain(this.props.account.blockchain).config;

        return (
            <View key="enterAmount" style={this.props.styles.amountContainer}>
                <EnterAmount
                    availableAmount={this.state.availableAmount}
                    minimumAmount={'0'}
                    value={this.state.amount}
                    insufficientFunds={this.state.insufficientFunds}
                    insufficientMinimumAmount={false}
                    token={this.props.token}
                    account={this.props.account}
                    onChange={amount => this.addAmount(amount)}
                />
                <FeeOptions
                    transactionType={TransactionType.TRANSFER}
                    token={this.props.account.tokens[this.props.chainId][config.coin]}
                    sendingToken={this.props.token}
                    account={this.props.account}
                    toAddress={this.state.toAddress}
                    onFeesChanged={(feeOptions: IFeeOptions) => this.onFeesChanged(feeOptions)}
                    insufficientFundsFees={this.state.insufficientFundsFees}
                />
            </View>
        );
    }

    private renderConfirmTransaction() {
        const { resolvedAddress, toAddress } = this.state;
        const { account, chainId, styles } = this.props;
        const { blockchain } = account;
        const config = getBlockchain(blockchain).config;
        const extraFields = config.ui.extraFields;

        const feeToken = getTokenConfig(
            account.blockchain,
            account.tokens[chainId][config.coin].symbol
        );
        const feeTokenSymbol = config.feeOptions.gasPriceToken;

        const tokenInfo = getTokenConfig(blockchain, this.props.token.symbol);

        return (
            <View key="confirmTransaction" style={styles.confirmTransactionContainer}>
                <Text style={styles.receipientLabel}>{translate('Send.recipientLabel')}</Text>
                <View
                    style={[
                        styles.inputBox,
                        resolvedAddress && resolvedAddress !== toAddress
                            ? null
                            : { marginBottom: BASE_DIMENSION * 2 }
                    ]}
                >
                    <Text style={styles.confirmTransactionText}>
                        {formatAddress(
                            resolvedAddress ? resolvedAddress : this.state.toAddress,
                            blockchain
                        )}
                    </Text>
                </View>
                {resolvedAddress && resolvedAddress !== '' && resolvedAddress !== toAddress && (
                    <Text style={styles.displayAddress}>{toAddress}</Text>
                )}
                <Text style={styles.receipientLabel}>{translate('Send.amount')}</Text>
                <View style={[styles.inputBox, { marginBottom: BASE_DIMENSION * 2 }]}>
                    <Text style={styles.confirmTransactionText}>
                        {`${this.state.amount} ${this.props.token.symbol}`}
                    </Text>
                </View>

                <Text style={styles.receipientLabel}>{translate('App.labels.fees')}</Text>
                <View style={[styles.inputBox, { marginBottom: BASE_DIMENSION * 2 }]}>
                    <Amount
                        style={styles.confirmTransactionText}
                        token={feeTokenSymbol}
                        tokenDecimals={feeToken.decimals}
                        amount={this.state.feeOptions?.feeTotal}
                        blockchain={blockchain}
                    />
                </View>

                {blockchain === Blockchain.SOLANA &&
                    tokenInfo.type === TokenType.SPL &&
                    !this.state.splActiveToken && (
                        <View>
                            <Text style={styles.receipientLabel}>
                                {translate('App.labels.rent')}
                            </Text>
                            <View style={[styles.inputBox, { marginBottom: BASE_DIMENSION * 2 }]}>
                                <Text style={styles.confirmTransactionText}>
                                    {'0.00203928 SOL'}
                                </Text>
                            </View>
                        </View>
                    )}

                {extraFields && extraFields.map(value => this.renderExtraFields(value))}
            </View>
        );
    }

    public render() {
        const { styles } = this.props;
        const { headerSteps } = this.state;
        return (
            <View style={styles.container}>
                <TestnetBadge />

                <KeyboardAwareScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    alwaysBounceVertical={false}
                >
                    <View style={styles.content}>
                        <HeaderStepByStep
                            steps={headerSteps}
                            selectStep={selectedIdex => {
                                const activeIndex = findIndex(headerSteps, ['active', true]);

                                const steps = headerSteps;
                                if (selectedIdex < activeIndex) {
                                    steps[activeIndex].active = false;
                                    steps[selectedIdex].active = true;
                                }
                            }}
                        />

                        {this.state.isLoading ? (
                            <LoadingIndicator />
                        ) : (
                            headerSteps.map((step, index) => {
                                if (step.active) {
                                    switch (index) {
                                        case 0:
                                            return this.renderAddAddressContainer();
                                        case 1:
                                            return this.renderEnterAmount();
                                        case 2:
                                            return this.renderConfirmTransaction();
                                        default:
                                            return null;
                                    }
                                }
                            })
                        )}
                    </View>
                </KeyboardAwareScrollView>

                {this.renderBottomConfirm()}
            </View>
        );
    }
}

export const SendScreen = smartConnect(SendScreenComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider),
    withNavigationParams()
]);
