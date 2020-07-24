import React from 'react';
import { IReduxState } from '../../../../redux/state';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../../../core/theme/with-theme';
import { smartConnect } from '../../../../core/utils/smart-connect';
import { connect } from 'react-redux';
import { translate } from '../../../../core/i18n';
import { getBlockchain } from '../../../../core/blockchain/blockchain-factory';

import { getAccount } from '../../../../redux/wallets/selectors';
import { Blockchain, ChainIdType, IFeeOptions } from '../../../../core/blockchain/types';
import { IAccountState, ITokenState } from '../../../../redux/wallets/state';
import { getChainId } from '../../../../redux/preferences/selectors';
import { IValidator } from '../../../../core/blockchain/types/stats';
import { INavigationProps } from '../../../../navigation/with-navigation-params';
import {
    navigateToConfirmationStep,
    REDELEGATE_CONFIRMATION
} from '../../../../redux/ui/screens/posActions/actions';
import { EnterAmountComponent } from '../../components/enter-amount-component/enter-amount-component';
import bind from 'bind-decorator';

export interface IReduxProps {
    account: IAccountState;
    chainId: ChainIdType;
    navigateToConfirmationStep: typeof navigateToConfirmationStep;
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
    validators: IValidator[];
    actionText: string;
}

export const mapStateToProps = (state: IReduxState) => {
    const accountIndex = state.ui.screens.posActions.delegateEnterAmount.accountIndex;
    const blockchain = state.ui.screens.posActions.delegateEnterAmount.blockchain;
    return {
        account: getAccount(state, accountIndex, blockchain),
        chainId: getChainId(state, blockchain),
        accountIndex,
        blockchain,
        token: state.ui.screens.posActions.delegateEnterAmount.token,
        validators: state.ui.screens.posActions.delegateEnterAmount.validators,
        actionText: state.ui.screens.posActions.delegateEnterAmount.actionText
    };
};

const mapDispatchToProps = {
    navigateToConfirmationStep
};

interface IState {
    amount: string;
    insufficientFunds: boolean;
    feeOptions: IFeeOptions;
    insufficientFundsFees: boolean;
}

export const navigationOptions = ({ navigation }: any) => ({
    title: navigation?.state?.params?.actionText && translate(navigation?.state?.params?.actionText)
});

export class RedelegateEnterAmountComponent extends React.Component<
    INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>,
    IState
> {
    public static navigationOptions = navigationOptions;

    constructor(
        props: INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>
    ) {
        super(props);

        const blockchainInstance = getBlockchain(props.account.blockchain);

        const stepList = [];
        blockchainInstance.config.ui.token.sendStepLabels.map((step, index) => {
            stepList.push({
                step: index,
                title: translate(step),
                active: index === 1 ? true : false
            });
        });

        this.state = {
            amount: '',
            insufficientFunds: false,
            feeOptions: undefined,
            insufficientFundsFees: false
        };
    }

    public componentDidMount() {
        this.props.navigation.setParams({ actionText: this.props.actionText });
    }

    @bind
    public onPressNext(amount: string, feeOptions: IFeeOptions) {
        this.props.navigateToConfirmationStep(
            this.props.accountIndex,
            this.props.blockchain,
            this.props.token,
            this.props.validators,
            this.props.actionText,
            'RedelegateConfirm',
            REDELEGATE_CONFIRMATION,
            amount,
            feeOptions
        );
    }

    public render() {
        return (
            <EnterAmountComponent
                account={this.props.account}
                chainId={this.props.chainId}
                token={this.props.token}
                validators={this.props.validators}
                actionText={this.props.actionText}
                bottomColor={this.props.theme.colors.labelRedelegate}
                bottomActionText={'App.labels.from'}
                bottomButtonText={'App.labels.next'}
                showSteps={true}
                onPressNext={this.onPressNext}
            />
        );
    }
}
export const RedelegateEnterAmount = smartConnect(RedelegateEnterAmountComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);