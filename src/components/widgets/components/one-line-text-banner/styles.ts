import { StyleSheet } from 'react-native';
import { ITheme } from '../../../../core/theme/itheme';
import { BASE_DIMENSION, normalizeFontAndLineHeight } from '../../../../styles/dimensions';

export default (theme: ITheme) =>
    StyleSheet.create({
        container: {
            flexDirection: 'row',
            backgroundColor: theme.colors.appBackground,
            paddingVertical: BASE_DIMENSION,
            paddingHorizontal: BASE_DIMENSION
        },
        text: {
            flex: 1,
            fontSize: normalizeFontAndLineHeight(14),
            fontWeight: 'bold',
            color: theme.colors.accent
        }
    });