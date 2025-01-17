import { ITokenConfigState } from '../../../../redux/tokens/state';
import { TokenScreenComponentType, TokenType } from '../../types/token';

export const XCAD_MAINNET: ITokenConfigState = {
    name: 'XCAD Network',
    symbol: 'XCAD',
    icon: {
        uri: 'https://fire.moonlet.io/static/tokens/icons/zilliqa/xcad.png'
    },
    contractAddress: 'zil1h63h5rlg7avatnlzhfnfzwn8vfspwkapzdy2aw',
    removable: true,
    defaultOrder: 999,
    decimals: 6,
    ui: {
        decimals: 3,
        tokenScreenComponent: TokenScreenComponentType.DEFAULT
    },
    type: TokenType.ZRC2
};
