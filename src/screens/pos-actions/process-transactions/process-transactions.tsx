import React from 'react';
import { View } from 'react-native';
import { Text, Button } from '../../../library';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../../core/theme/with-theme';
import { smartConnect } from '../../../core/utils/smart-connect';
import { INavigationProps } from '../../../navigation/with-navigation-params';
import { translate } from '../../../core/i18n';
import Icon from '../../../components/icon/icon';
import { IconValues } from '../../../components/icon/values';
import { normalize } from '../../../styles/dimensions';
import { LoadingIndicator } from '../../../components/loading-indicator/loading-indicator';
import { closeProcessTransactions } from '../../../redux/ui/process-transactions/actions';
import { IReduxState } from '../../../redux/state';
import { connect } from 'react-redux';
import { IBlockchainTransaction } from '../../../core/blockchain/types';
import { TransactionStatus, WalletType } from '../../../core/wallet/types';
import { getTokenConfig } from '../../../redux/tokens/static-selectors';
import { getBlockchain } from '../../../core/blockchain/blockchain-factory';
import BigNumber from 'bignumber.js';
import { formatNumber } from '../../../core/utils/format-number';
import { getSelectedWallet } from '../../../redux/wallets/selectors';
import { PosBasicActionType } from '../../../core/blockchain/types/token';
import { formatValidatorName } from '../../../core/utils/format-string';

export interface IReduxProps {
    isVisible: boolean;
    transactions: IBlockchainTransaction[];
    closeProcessTransactions: typeof closeProcessTransactions;
    walletType: WalletType;
}

export const mapStateToProps = (state: IReduxState) => {
    return {
        isVisible: state.ui.processTransactions.isVisible,
        transactions: state.ui.processTransactions.data.txs,
        walletType: getSelectedWallet(state)?.type
    };
};

const mapDispatchToProps = {
    closeProcessTransactions
};

interface IState {
    disabledButton: boolean;
}

export class ProcessTransactionsComponent extends React.Component<
    INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>,
    IState
> {
    constructor(
        props: INavigationProps & IThemeProps<ReturnType<typeof stylesProvider>> & IReduxProps
    ) {
        super(props);

        this.state = {
            disabledButton: true
        };
    }

    public componentDidUpdate(prevProps: IReduxProps) {
        if (this.props.transactions !== prevProps.transactions) {
            let hasPending = false;
            let disabledButton = true;
            for (const tx of this.props.transactions) {
                if (
                    tx.status === TransactionStatus.FAILED ||
                    tx.status === TransactionStatus.DROPPED
                )
                    disabledButton = false;
                if (tx.status === TransactionStatus.PENDING) hasPending = true;
            }
            if (!hasPending) disabledButton = false;
            this.setState({ disabledButton });
        }
    }

    private formatTopMiddleAndBottomText(
        tx: IBlockchainTransaction
    ): { topText: string; middleText: string; bottomText: string } {
        const tokenConfig = getTokenConfig(tx.blockchain, tx.token.symbol);
        const blockchainInstance = getBlockchain(tx.blockchain);
        const feesNumber = blockchainInstance.account.amountFromStd(
            new BigNumber(tx.feeOptions.feeTotal),
            tokenConfig.decimals
        );

        const fees = formatNumber(new BigNumber(feesNumber), {
            currency: blockchainInstance.config.coin
        });

        if (tx.amount === '0') {
            tx.amount = tx.data.params.length > 1 ? tx.data.params[1] : tx.data.params[0];
        }
        const amountNumber = blockchainInstance.account.amountFromStd(
            new BigNumber(tx.amount),
            tokenConfig.decimals
        );

        const amount = formatNumber(new BigNumber(amountNumber), {
            currency: blockchainInstance.config.coin
        });

        let middleText = '';
        let topText = '';
        switch (tx.additionalInfo?.posAction) {
            case PosBasicActionType.CREATE_ACCOUNT: {
                topText = translate('Transaction.registerAccount');
                break;
            }
            case PosBasicActionType.LOCK: {
                topText = translate('App.labels.locking') + ' ' + amount;
                break;
            }
            case PosBasicActionType.DELEGATE: {
                middleText =
                    translate('App.labels.to').toLowerCase() +
                    ' ' +
                    formatValidatorName(tx.additionalInfo?.validatorName, 20);
                topText = translate('App.labels.voting') + ' ' + amount;
                break;
            }
            case PosBasicActionType.UNLOCK: {
                topText = translate('App.labels.unlocking') + ' ' + amount;
                break;
            }
            case PosBasicActionType.UNVOTE: {
                middleText =
                    translate('App.labels.from').toLowerCase() +
                    ' ' +
                    formatValidatorName(tx.additionalInfo?.validatorName, 20);
                topText = translate('App.labels.unvoting') + ' ' + amount;
                break;
            }
            case PosBasicActionType.ACTIVATE: {
                topText = translate('Validator.activatingVotes');
                break;
            }
            default: {
                middleText = '';
                topText = amount;
            }
        }

        return { topText, middleText, bottomText: fees };
    }

    private renderCard(tx: IBlockchainTransaction, index: number) {
        const { styles, theme } = this.props;
        const status = tx.status;

        const { topText, middleText, bottomText } = this.formatTopMiddleAndBottomText(tx);

        let leftIcon = '';
        let rightText = '';
        let iconColor = '';

        switch (status) {
            case TransactionStatus.FAILED: {
                leftIcon = IconValues.FAILED;
                rightText = translate('App.labels.failed');
                iconColor = theme.colors.disabledButton;
                break;
            }
            case TransactionStatus.SUCCESS: {
                leftIcon = IconValues.VOTE;
                iconColor = theme.colors.accent;
                break;
            }
            case TransactionStatus.DROPPED: {
                leftIcon = IconValues.FAILED;
                rightText = translate('App.labels.canceled');
                iconColor = theme.colors.disabledButton;
                break;
            }
            case TransactionStatus.PENDING: {
                leftIcon = IconValues.PENDING;
                iconColor = theme.colors.warning;
                break;
            }
            default: {
                leftIcon = IconValues.PENDING;
                rightText = '';
                iconColor = theme.colors.warning;
            }
        }

        return (
            <View key={index + '-view-key'} style={styles.cardContainer}>
                <Icon
                    name={leftIcon}
                    size={normalize(30)}
                    style={[
                        styles.cardLeftIcon,
                        {
                            color: iconColor
                        }
                    ]}
                />

                <View style={styles.cardTextContainer}>
                    <Text style={styles.topText}>{topText}</Text>
                    <Text style={styles.middleText}>{middleText}</Text>
                    <Text style={styles.bottomText}>
                        {translate('App.labels.fees') + ': ' + bottomText}
                    </Text>
                </View>

                {status === TransactionStatus.PENDING && (
                    <View>
                        <LoadingIndicator />
                    </View>
                )}

                {status === TransactionStatus.SUCCESS ? (
                    <Icon name={IconValues.CHECK} size={normalize(16)} style={styles.successIcon} />
                ) : (
                    <Text style={styles.failedText}>{rightText}</Text>
                )}
            </View>
        );
    }

    public render() {
        const { styles } = this.props;

        const title =
            this.props.walletType === WalletType.HW
                ? translate('Transaction.processTitleTextLedger')
                : translate('Transaction.processTitleText');

        if (this.props.isVisible) {
            return (
                <View style={styles.container}>
                    <Text style={styles.screenTitle}>{translate('App.labels.processing')}</Text>

                    <Text style={styles.title}>{title}</Text>

                    {this.props.transactions.length ? (
                        <View style={styles.content}>
                            {this.props.transactions.map((tx, index) => {
                                return this.renderCard(tx, index);
                            })}
                        </View>
                    ) : (
                        <LoadingIndicator />
                    )}

                    <Button
                        primary
                        onPress={() => {
                            this.props.closeProcessTransactions();
                        }}
                        wrapperStyle={styles.continueButton}
                        disabled={this.state.disabledButton}
                    >
                        {translate('App.labels.continue')}
                    </Button>
                </View>
            );
        } else {
            return null;
        }
    }
}

export const ProcessTransactions = smartConnect(ProcessTransactionsComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);