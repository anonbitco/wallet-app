import React from 'react';
import { IReduxState } from '../../../../redux/state';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../../../core/theme/with-theme';
import { smartConnect } from '../../../../core/utils/smart-connect';
import { connect } from 'react-redux';
import { translate } from '../../../../core/i18n';
import { getAccount } from '../../../../redux/wallets/selectors';
import { Blockchain, ChainIdType, IFeeOptions } from '../../../../core/blockchain/types';
import { IAccountState, ITokenState } from '../../../../redux/wallets/state';
import { getChainId } from '../../../../redux/preferences/selectors';
import { IValidator } from '../../../../core/blockchain/types/stats';
import { INavigationProps } from '../../../../navigation/with-navigation-params';
import { EnterAmountComponent } from '../../components/enter-amount-component/enter-amount-component';
import { bind } from 'bind-decorator';
import { PasswordModal } from '../../../../components/password-modal/password-modal';
import { delegate } from '../../../../redux/wallets/actions';

export interface IReduxProps {
    account: IAccountState;
    chainId: ChainIdType;
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
    validators: IValidator[];
    actionText: string;
    delegate: typeof delegate;
}

export const mapStateToProps = (state: IReduxState) => {
    const accountIndex = state.ui.screens.posActions.quickDelegateEnterAmount.accountIndex;
    const blockchain = state.ui.screens.posActions.quickDelegateEnterAmount.blockchain;
    return {
        account: getAccount(state, accountIndex, blockchain),
        chainId: getChainId(state, blockchain),
        accountIndex,
        blockchain,
        token: state.ui.screens.posActions.quickDelegateEnterAmount.token,
        validators: state.ui.screens.posActions.quickDelegateEnterAmount.validators,
        actionText: state.ui.screens.posActions.quickDelegateEnterAmount.actionText
    };
};

const mapDispatchToProps = {
    delegate
};

export const navigationOptions = ({ navigation }: any) => ({
    title: navigation?.state?.params?.actionText && translate(navigation?.state?.params?.actionText)
});

export class QuickDelegateEnterAmountComponent extends React.Component<
    INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>
> {
    public static navigationOptions = navigationOptions;

    constructor(
        props: INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>
    ) {
        super(props);
    }

    public componentDidMount() {
        this.props.navigation.setParams({ actionText: this.props.actionText });
    }

    @bind
    private async onPressConfirm(amount: string, feeOptions: IFeeOptions) {
        try {
            const password = await PasswordModal.getPassword(
                translate('Password.pinTitleUnlock'),
                translate('Password.subtitleSignTransaction'),
                { sensitive: true, showCloseButton: true }
            );
            this.props.delegate(
                this.props.account,
                amount,
                this.props.validators,
                this.props.token.symbol,
                feeOptions,
                password,
                this.props.navigation,
                undefined
            );
        } catch {
            //
        }
    }

    public render() {
        return (
            <EnterAmountComponent
                account={this.props.account}
                chainId={this.props.chainId}
                token={this.props.token}
                validators={this.props.validators}
                actionText={this.props.actionText}
                bottomColor={this.props.theme.colors.accent}
                bottomActionText={'App.labels.for'}
                bottomButtonText={'App.labels.confirm'}
                showSteps={false}
                onPressNext={this.onPressConfirm}
            />
        );
    }
}

export const QuickDelegateEnterAmount = smartConnect(QuickDelegateEnterAmountComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);