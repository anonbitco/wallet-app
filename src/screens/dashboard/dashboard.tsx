import React from 'react';
import stylesProvider from './styles';
import { View, Animated, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Text } from '../../library';
import { INavigationProps } from '../../navigation/with-navigation-params';
import { TokenDashboard } from '../../components/token-dashboard/token-dashboard';
import { IReduxState } from '../../redux/state';
import { IAccountState, IWalletState } from '../../redux/wallets/state';
import { Blockchain, ChainIdType } from '../../core/blockchain/types';
import { smartConnect } from '../../core/utils/smart-connect';
import { connect } from 'react-redux';
import { withTheme, IThemeProps } from '../../core/theme/with-theme';
import { getBalance } from '../../redux/wallets/actions';
import { getBlockchain } from '../../core/blockchain/blockchain-factory';
import {
    getSelectedWallet,
    getSelectedAccount,
    getSelectedBlockchain,
    getSelectedBlockchainAccounts
} from '../../redux/wallets/selectors';
import { HeaderIcon } from '../../components/header-icon/header-icon';
import { Icon } from '../../components/icon/icon';
import { themes } from '../../navigation/navigation';
import {
    ICON_SIZE,
    ICON_CONTAINER_SIZE,
    BASE_DIMENSION,
    normalize,
    SCREEN_HEIGHT,
    normalizeFontAndLineHeight,
    LETTER_SPACING
} from '../../styles/dimensions';
import { ConnectExtensionWeb } from '../../core/connect-extension/connect-extension-web';
import { openBottomSheet } from '../../redux/ui/bottomSheet/actions';
import { BottomSheetType } from '../../redux/ui/bottomSheet/state';
import { calculateBalance } from '../../core/utils/balance';
import { getBlockchains, getChainId } from '../../redux/preferences/selectors';
import { NavigationEvents, StackActions } from 'react-navigation';
import { TestnetBadge } from '../../components/testnet-badge/testnet-badge';
import { IExchangeRates } from '../../redux/market/state';
import { formatAddress } from '../../core/utils/format-address';
import { Amount } from '../../components/amount/amount';
import { LoadingIndicator } from '../../components/loading-indicator/loading-indicator';
import { getTokenConfig } from '../../redux/tokens/static-selectors';
import { IconValues } from '../../components/icon/values';
import { BottomBlockchainNavigation } from '../../components/bottom-blockchain-navigation/bottom-blockchain-navigation';
import {
    startNotificationsHandlers,
    getUnseenNotifications
} from '../../redux/notifications/actions';
import { LedgerBadge } from '../../components/ledger-badge/ledger-badge';
import { isFeatureActive, RemoteFeature } from '../../core/utils/remote-feature-config';
import { fetchScreenData } from '../../redux/ui/screens/data/actions';
import { ContextScreen } from '../../components/widgets/types';

const ANIMATION_MAX_HEIGHT = normalize(160);
const ANIMATION_MIN_HEIGHT = normalize(70);

interface IReduxProps {
    wallet: IWalletState;
    walletsNr: number;
    getBalance: typeof getBalance;
    blockchains: Blockchain[];
    openBottomSheet: typeof openBottomSheet;
    selectedAccount: IAccountState;
    selectedBlockchain: Blockchain;
    exchangeRates: IExchangeRates;
    selectedBlockchainAccounts: IAccountState[];
    userCurrency: string;
    chainId: ChainIdType;
    deviceId: string;
    startNotificationsHandlers: typeof startNotificationsHandlers;
    unseenNotifications: number;
    getUnseenNotifications: typeof getUnseenNotifications;
    fetchScreenData: typeof fetchScreenData;
    cumulativeBalance: boolean;
}

const mapStateToProps = (state: IReduxState) => {
    const selectedAccount = getSelectedAccount(state);

    return {
        wallet: getSelectedWallet(state),
        walletsNr: Object.keys(state.wallets).length,
        blockchains: getBlockchains(state),
        selectedBlockchain: getSelectedBlockchain(state),
        selectedAccount,
        exchangeRates: state.market.exchangeRates,
        selectedBlockchainAccounts: getSelectedBlockchainAccounts(state),
        userCurrency: state.preferences.currency,
        chainId: selectedAccount ? getChainId(state, selectedAccount.blockchain) : '',
        deviceId: state.preferences.deviceId,
        unseenNotifications: state.notifications.unseenNotifications,
        cumulativeBalance: state.preferences.cumulativeBalance
    };
};

const mapDispatchToProps = {
    getBalance,
    openBottomSheet,
    startNotificationsHandlers,
    getUnseenNotifications,
    fetchScreenData
};

interface IState {
    isLoading: boolean;
}

const MyTitle = ({ text }) => (
    <Text
        style={{
            flex: 1,
            fontSize: normalizeFontAndLineHeight(20),
            lineHeight: normalizeFontAndLineHeight(44),
            letterSpacing: LETTER_SPACING,
            textAlign: 'center'
        }}
    >
        {text}
    </Text>
);
const MyConnectedTitle = connect((state: IReduxState) => ({
    text: (getSelectedWallet(state) || {}).name
}))(MyTitle);

const UnreadNotifCircle = () => (
    <View
        style={{
            position: 'absolute',
            top: -BASE_DIMENSION / 2,
            left: BASE_DIMENSION + BASE_DIMENSION / 2,
            backgroundColor: themes.dark.colors.appBackground,
            padding: BASE_DIMENSION / 4
        }}
    >
        <View
            style={{
                flex: 1,
                width: normalize(14),
                height: normalize(14),
                borderRadius: normalize(14),
                backgroundColor: themes.dark.colors.negative
            }}
        />
    </View>
);

const navigationOptions = ({ navigation, theme }: any) => ({
    headerTitle: () => <MyConnectedTitle />,
    headerLeft: () => <HeaderIcon />,
    headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
                testID="wallets-icon"
                style={{ width: ICON_CONTAINER_SIZE }}
                onPress={() => navigation.navigate('Wallets')}
            >
                <Icon
                    name={IconValues.MONEY_WALLET}
                    size={ICON_SIZE}
                    style={{ color: themes[theme].colors.accent }}
                />
            </TouchableOpacity>

            {isFeatureActive(RemoteFeature.DEV_TOOLS) && (
                <View>
                    <TouchableOpacity
                        testID="notifications-icon"
                        style={{ width: ICON_CONTAINER_SIZE }}
                        onPress={() => navigation.navigate('Notifications')}
                    >
                        <Icon
                            name={IconValues.ALARM_BELL}
                            size={ICON_SIZE}
                            style={{ color: themes[theme].colors.accent }}
                        />
                        {navigation.state.params?.unseenNotifications > 0 && <UnreadNotifCircle />}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
});

export class DashboardScreenComponent extends React.Component<
    INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>,
    IState
> {
    public static navigationOptions = navigationOptions;
    private animationValue: any = new Animated.Value(0);
    private scrollViewRef: any;

    constructor(
        props: INavigationProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>
    ) {
        super(props);
        this.state = {
            isLoading: false
        };
        this.scrollViewRef = React.createRef();
    }

    public async componentDidMount() {
        if (Platform.OS === 'web') {
            this.setState({ isLoading: true });
            if ((await ConnectExtensionWeb.isConnected()) === false) {
                this.setState({ isLoading: false });
                this.props.navigation.navigate('OnboardingNavigation');
            } else {
                this.setState({ isLoading: false });
                ConnectExtensionWeb.listenLastSync();
            }
        } else {
            if (this.props.blockchains.length === 0 || this.props.walletsNr < 1) {
                // maybe check this in another screen?
                this.props.navigation.dispatch(StackActions.popToTop());
                this.props.navigation.navigate('OnboardingNavigation');
            }
        }

        this.props.navigation.setParams({
            setDashboardMenuBottomSheet: this.setDashboardMenuBottomSheet
        });

        setTimeout(() => this.props.startNotificationsHandlers(), 10000);

        this.props.navigation.setParams({
            unseenNotifications: this.props.unseenNotifications
        });
    }

    public componentDidUpdate(prevProps: IReduxProps) {
        if (
            this.props.selectedAccount?.address !== prevProps.selectedAccount?.address &&
            Platform.OS === 'web'
        ) {
            // Used on web to get balances when selectedAccount is changed
            // NavigationEvents is not enough for the web in order to get balances
            this.onFocus();
        }

        if (this.props.wallet?.id !== prevProps.wallet?.id) {
            this.props.getUnseenNotifications();
        }

        if (this.props.unseenNotifications !== prevProps.unseenNotifications) {
            this.props.navigation.setParams({
                unseenNotifications: this.props.unseenNotifications
            });
        }
    }

    public setDashboardMenuBottomSheet = () => {
        this.props.openBottomSheet(BottomSheetType.DASHBOARD_MENU);
    };

    public onFocus() {
        if (this.props.selectedAccount) {
            this.props.getBalance(
                this.props.selectedAccount.blockchain,
                this.props.selectedAccount.address,
                undefined,
                true
            );
        }

        this.props.fetchScreenData({
            screen: ContextScreen.DASHBOARD
        });
    }

    private renderCoinBalanceCard() {
        const { styles, selectedAccount, chainId } = this.props;
        const blockchain: Blockchain = this.props.selectedBlockchain;

        const blockchainConfig = blockchain && getBlockchain(blockchain).config;
        const tokenConfig = getTokenConfig(blockchain, blockchainConfig.coin);

        const balance =
            selectedAccount &&
            calculateBalance(
                selectedAccount,
                chainId,
                this.props.exchangeRates,
                tokenConfig,
                this.props.cumulativeBalance
            );

        const animatePrimaryAmountFontSize = this.animationValue.interpolate({
            inputRange: [0, ANIMATION_MAX_HEIGHT, ANIMATION_MAX_HEIGHT + 1],
            outputRange: [
                normalizeFontAndLineHeight(30),
                normalizeFontAndLineHeight(19),
                normalizeFontAndLineHeight(19)
            ],
            extrapolate: 'clamp'
        });

        // const animateConvertedAmountFontSize = this.animationValue.interpolate({
        //     inputRange: [0, ANIMATION_MAX_HEIGHT, ANIMATION_MAX_HEIGHT + 1],
        //     outputRange: [
        //         normalizeFontAndLineHeight(16),
        //         normalizeFontAndLineHeight(13),
        //         normalizeFontAndLineHeight(13)
        //     ],
        //     extrapolate: 'clamp'
        // });

        const animateCoinBalanceCardHeight = this.animationValue.interpolate({
            inputRange: [0, ANIMATION_MAX_HEIGHT, ANIMATION_MAX_HEIGHT + 1],
            outputRange: [ANIMATION_MAX_HEIGHT, ANIMATION_MIN_HEIGHT, ANIMATION_MIN_HEIGHT],
            extrapolate: 'clamp'
        });

        const animateHideAccountAddress = this.animationValue.interpolate({
            inputRange: [0, ANIMATION_MAX_HEIGHT / 2, ANIMATION_MAX_HEIGHT],
            outputRange: Platform.select({
                default: [0, 0, 1],
                web: [1, 1, 0]
            }),
            extrapolate: 'clamp'
        });

        const animateOpacityAccountAddressWeb = this.animationValue.interpolate({
            inputRange: [0, ANIMATION_MIN_HEIGHT / 2, ANIMATION_MAX_HEIGHT],
            outputRange: [1, 0.5, 0],
            extrapolate: 'clamp'
        });

        const animateParimaryAmountVerticalPadding = this.animationValue.interpolate({
            inputRange: [0, ANIMATION_MAX_HEIGHT / 2, ANIMATION_MAX_HEIGHT],
            outputRange: [BASE_DIMENSION, BASE_DIMENSION / 2, 0],
            extrapolate: 'clamp'
        });

        const defaultAccountName = selectedAccount && `Account ${selectedAccount.index + 1}`;

        return (
            <Animated.View
                style={[styles.coinBalanceCard, { height: animateCoinBalanceCardHeight }]}
            >
                <TouchableOpacity
                    testID="coin-balance-card"
                    onPress={() => {
                        // TODO: fix bottom sheet experience
                        // this.props.openBottomSheet(BottomSheetType.ACCOUNTS, { blockchain });
                    }}
                    activeOpacity={1}
                >
                    {selectedAccount && (
                        <Animated.View
                            style={[
                                styles.row,
                                {
                                    flex: animateHideAccountAddress,
                                    opacity: Platform.select({
                                        default: 1,
                                        web: animateOpacityAccountAddressWeb
                                    })
                                }
                            ]}
                        >
                            <Text
                                testID={
                                    blockchain.toLocaleLowerCase() +
                                    '-' +
                                    defaultAccountName.replace(/ /g, '-').toLowerCase()
                                }
                                style={styles.account}
                            >
                                {selectedAccount.name || defaultAccountName}
                            </Text>
                            <Text style={styles.address}>
                                {formatAddress(selectedAccount.address, blockchain)}
                            </Text>
                        </Animated.View>
                    )}

                    <Animated.View
                        style={[
                            styles.row,
                            { paddingVertical: animateParimaryAmountVerticalPadding }
                        ]}
                    >
                        <Amount
                            style={[styles.mainText, { fontSize: animatePrimaryAmountFontSize }]}
                            amount={String(balance)}
                            token={blockchainConfig.coin}
                            tokenDecimals={tokenConfig.decimals}
                            blockchain={blockchain}
                            convert
                            isAnimated={true}
                            smallFontToken={{
                                visible: true
                            }}
                        />
                    </Animated.View>

                    {/* <View style={styles.row}>
                        <Amount
                            testID={this.props.userCurrency}
                            style={[
                                styles.secondaryText,
                                { fontSize: animateConvertedAmountFontSize }
                            ]}
                            amount={String(balance)}
                            token={blockchainConfig.coin}
                            tokenDecimals={tokenConfig.decimals}
                            blockchain={blockchain}
                            convert
                            isAnimated={true}
                        />
                    </View> */}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    private renderTokenDashboard() {
        const styles = this.props.styles;
        const { blockchains, chainId } = this.props;
        const blockchain: Blockchain = this.props.selectedBlockchain;

        return (
            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={ref => (this.scrollViewRef = ref)}
                    contentContainerStyle={[
                        styles.dashboardContainer,
                        {
                            paddingTop: ANIMATION_MAX_HEIGHT // TODO: animate this
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: this.animationValue } } }],
                        { useNativeDriver: false }
                    )}
                    alwaysBounceVertical={false}
                >
                    <TokenDashboard
                        account={this.props.selectedAccount}
                        blockchain={blockchain}
                        navigation={this.props.navigation}
                        showBottomPadding={blockchains?.length > 1}
                        chainId={chainId}
                    />
                </ScrollView>
                {this.props.selectedBlockchain && this.renderCoinBalanceCard()}
            </View>
        );
    }

    public render() {
        const { wallet, styles } = this.props;

        if (Platform.OS === 'web' && this.state.isLoading) {
            return (
                <View style={styles.container}>
                    <LoadingIndicator />
                </View>
            );
        }

        const containerHeight =
            Platform.OS === 'web'
                ? this.props.blockchains.length === 1
                    ? SCREEN_HEIGHT
                    : 'calc(100vh - 122px)'
                : 'auto';

        return (
            <View testID="dashboard-screen" style={[styles.container, { height: containerHeight }]}>
                <TestnetBadge />
                <LedgerBadge hwOptions={wallet?.hwOptions} />

                <NavigationEvents onWillFocus={() => this.onFocus()} />

                {this.renderTokenDashboard()}

                <BottomBlockchainNavigation
                    onPress={() => this.scrollViewRef.scrollTo({ y: 0, animated: true })}
                />
            </View>
        );
    }
}

export const DashboardScreen = smartConnect(DashboardScreenComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);
