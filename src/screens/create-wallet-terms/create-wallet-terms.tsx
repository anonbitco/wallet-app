import React from 'react';
import { View, Image } from 'react-native';
import { NavigationParams, NavigationScreenProp, NavigationState } from 'react-navigation';
import { Button } from '../../library/button/button';

import stylesProvider from './styles';
import { withTheme } from '../../core/theme/with-theme';
import { HeaderLeft } from '../../components/header-left/header-left';

export interface IProps {
    navigation: NavigationScreenProp<NavigationState, NavigationParams>;
    styles: ReturnType<typeof stylesProvider>;
}

export const CreateWalletTermsScreenComponent = (props: IProps) => (
    <View style={props.styles.container}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
            <View
                style={{
                    alignItems: 'center',
                    alignSelf: 'stretch'
                }}
            >
                <Image source={require('../../assets/images/png/document.png')} />
            </View>
        </View>

        <View style={props.styles.buttonsContainer}>
            <Button
                testID="button-accept"
                style={props.styles.bottomButton}
                primary
                onPress={() => {
                    props.navigation.navigate('CreateWalletMnemonic');
                }}
            >
                Accept
            </Button>
        </View>
    </View>
);

export const navigationOptions = ({ navigation }: any) => ({
    headerLeft: () => {
        if (navigation.state && navigation.state.params && navigation.state.params.goBack) {
            return (
                <HeaderLeft
                    icon="arrow-left-1"
                    text="Back"
                    onPress={() => {
                        navigation.state.params.goBack(navigation);
                    }}
                />
            );
        }

        return null;
    },
    title: 'Wallet terms'
});

export const CreateWalletTermsScreen = withTheme(stylesProvider)(CreateWalletTermsScreenComponent);

CreateWalletTermsScreen.navigationOptions = navigationOptions;