import React from 'react';
import { View, Image } from 'react-native';
import { Button, Text } from '../../../library';
import { IExtensionRequest } from '../../../core/communication/extension';
import { translate } from '../../../core/i18n';
import { ConnectExtension } from '../../../core/connect-extension/connect-extension';
import bind from 'bind-decorator';
import { smartConnect } from '../../../core/utils/smart-connect';
import { withTheme, IThemeProps } from '../../../core/theme/with-theme';
import stylesProvider from './styles';
import { LoadingIndicator } from '../../../components/loading-indicator/loading-indicator';
import { ConnectExtensionWeb } from '../../../core/connect-extension/connect-extension-web';
import { NotificationType } from '../../../core/messaging/types';

interface IExternalProps {
    requestId: string;
    request: IExtensionRequest;
    onResponse: (response) => any;
}

export class NativeForwardComp extends React.Component<
    IExternalProps & IThemeProps<ReturnType<typeof stylesProvider>>
> {
    private getRequestPayload() {
        const rpcRequest = this.props.request.params[0];

        let sendRequestPayload;

        if (rpcRequest?.method && rpcRequest?.params) {
            switch (rpcRequest.method) {
                case 'CreateTransaction':
                    // todo generate payload
                    sendRequestPayload = {
                        method: this.props.request.params[0].method,
                        params: [this.props.requestId],
                        notification: {
                            title: translate('Notifications.extensionTx.title'),
                            body: translate('Notifications.extensionTx.body', {
                                formattedAmount: '1 ZIL',
                                formattedAddress: 'novi'
                            })
                        }
                    };
                    break;
                case 'SignMessage':
                    sendRequestPayload = {
                        method: NotificationType.MOONLET_SIGN_MESSAGE,
                        params: [
                            {
                                walletPubKey: this.props.request.walletPubKey,
                                blockchain: this.props.request.blockchain,
                                accountAddress: rpcRequest.params[0],
                                message: rpcRequest.params[1]
                            }
                        ],
                        notification: {
                            title: translate('Notifications.extensionSignMessage.title'),
                            body: translate('Notifications.extensionSignMessage.body')
                        }
                    };
                    break;
            }
        } else {
            throw new Error('Invalid request');
        }

        return sendRequestPayload;
    }

    public async componentDidMount() {
        /**
         * TODO:
         * - check transaction type:
         *      - Transfer native token / zrc 2
         *      - Contract call
         *      - Sign Message
         */

        // console.log('method: ', this.props.request.params[0].method);
        // console.log('requestId: ', this.props.requestId);

        try {
            const sendRequestRes = await ConnectExtension.sendRequest(this.getRequestPayload());
            // console.log('sendRequestRes: ', sendRequestRes);

            if (sendRequestRes?.success) {
                ConnectExtensionWeb.listenerReqResponse(
                    sendRequestRes.data.requestId,
                    async (res: { result: any; errorCode: string }) => {
                        if (res.errorCode) {
                            this.props.onResponse({
                                jsonrpc: '2.0',
                                error: {
                                    code: -1,
                                    message: 'GENERIC_ERROR: ' + res.errorCode
                                }
                            });

                            window.close();
                        } else {
                            let result = res.result;
                            if (res?.result?.rpcResponse) {
                                result = res.result.rpcResponse;
                            }

                            this.props.onResponse({
                                jsonrpc: '2.0',
                                result
                            });
                            window.close();
                        }
                    }
                );
            }
        } catch (err) {
            // console.log('error: ', err);
        }
    }

    @bind
    private onCancel() {
        this.props.onResponse({
            jsonrpc: '2.0',
            error: {
                code: -1,
                message: 'CANCELED_BY_USER: Operation cancelled by user'
            }
        });

        window.close();
    }

    // @bind
    // private onSign(result: any) {
    //     this.props.onResponse({
    //         jsonrpc: '2.0',
    //         result
    //     });
    // }

    public render() {
        const { styles } = this.props;
        return (
            <View style={styles.container}>
                <View style={styles.loadingHeaderContainer}>
                    <Image
                        source={require('../../../assets/images/png/moonlet_logo.png')}
                        style={styles.moonletLogo}
                    />
                    <Text style={styles.headerTitle}>{`Moonlet`}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <View>
                        <LoadingIndicator />
                    </View>
                    <Text style={styles.loadingText}>
                        {translate('ExtensionBackgroundRequest.waiting')}
                    </Text>
                </View>
                <Button onPress={this.onCancel}>{translate('App.labels.cancel')}</Button>
            </View>
        );
    }
}

export const NativeForwardComponent = smartConnect<IExternalProps>(NativeForwardComp, [
    withTheme(stylesProvider)
]);
